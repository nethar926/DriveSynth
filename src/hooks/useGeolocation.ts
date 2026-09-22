import { useCallback, useEffect, useRef, useState } from 'react';
import { kphToMph } from '../audio';

export type GpsStatus = 'idle' | 'requesting' | 'waiting' | 'live' | 'denied' | 'unavailable' | 'error';

export interface GpsState {
  status: GpsStatus;
  mph: number;
  accuracy: number | null;
  timestamp: number | null;
  /** How speed was estimated for the latest fix. */
  speedSource?: 'coords' | 'derived' | 'none';
  errorMessage?: string;
}

const MS_TO_MPH = 2.236936;
/** Ignore derived hops faster than this (m/s) — GPS jumps. */
const MAX_DERIVED_MS = 90; // ~200 mph
/** Smooth derived speed (0 = no smooth, 1 = sticky). */
const DERIVED_SMOOTH = 0.35;

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function useGeolocation(enabled: boolean) {
  const [state, setState] = useState<GpsState>({
    status: 'idle',
    mph: 0,
    accuracy: null,
    timestamp: null,
    speedSource: 'none',
  });
  const watchId = useRef<number | null>(null);
  const lastFix = useRef<{ lat: number; lon: number; t: number; mph: number } | null>(null);

  const stop = useCallback(() => {
    if (watchId.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
  }, []);

  const applyPosition = useCallback((pos: GeolocationPosition) => {
    const { latitude: lat, longitude: lon, speed: spd, accuracy } = pos.coords;
    const t = pos.timestamp || Date.now();

    let mph = 0;
    let speedSource: GpsState['speedSource'] = 'none';

    // Prefer coords.speed when the browser provides a real value (Tesla often returns null).
    if (spd != null && Number.isFinite(spd) && spd >= 0) {
      mph = spd * MS_TO_MPH;
      speedSource = 'coords';
    } else {
      const prev = lastFix.current;
      if (prev && Number.isFinite(lat) && Number.isFinite(lon)) {
        const dt = (t - prev.t) / 1000;
        if (dt > 0.2 && dt < 8) {
          const dist = haversineM(prev.lat, prev.lon, lat, lon);
          const ms = dist / dt;
          if (ms <= MAX_DERIVED_MS) {
            const rawMph = ms * MS_TO_MPH;
            mph = prev.mph * DERIVED_SMOOTH + rawMph * (1 - DERIVED_SMOOTH);
            speedSource = 'derived';
          }
        }
      }
    }

    // Stationary: if accuracy is poor and derived/coords near 0, clamp
    if (mph < 0.4) mph = 0;

    lastFix.current = {
      lat,
      lon,
      t,
      mph: speedSource === 'none' ? lastFix.current?.mph ?? 0 : mph,
    };

    setState({
      status: 'live',
      mph: speedSource === 'none' ? lastFix.current.mph : mph,
      accuracy: accuracy ?? null,
      timestamp: t,
      speedSource: speedSource === 'none' && lastFix.current.mph > 0 ? 'derived' : speedSource,
      errorMessage: undefined,
    });
  }, []);

  const start = useCallback(() => {
    if (!navigator.geolocation) {
      setState((s) => ({
        ...s,
        status: 'unavailable',
        errorMessage: 'Geolocation not available in this browser',
      }));
      return;
    }
    stop();
    lastFix.current = null;
    setState((s) => ({ ...s, status: 'requesting', errorMessage: undefined }));

    const onError = (err: GeolocationPositionError) => {
      if (err.code === err.PERMISSION_DENIED) {
        setState((s) => ({ ...s, status: 'denied', errorMessage: err.message }));
        stop();
        return;
      }
      // TIMEOUT / POSITION_UNAVAILABLE — keep watching; surface waiting
      setState((s) => ({
        ...s,
        status: s.status === 'live' ? 'live' : 'waiting',
        errorMessage: err.message,
      }));
    };

    const watchOpts: PositionOptions = {
      enableHighAccuracy: true,
      maximumAge: 1000,
      timeout: 20000, // Tesla Chromium is slow to first fix
    };

    // Warm permission + first fix (some WebViews need getCurrentPosition before watch)
    try {
      navigator.geolocation.getCurrentPosition(applyPosition, onError, {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000,
      });
    } catch {
      /* ignore */
    }

    watchId.current = navigator.geolocation.watchPosition(applyPosition, onError, watchOpts);

    window.setTimeout(() => {
      setState((s) => (s.status === 'requesting' ? { ...s, status: 'waiting' } : s));
    }, 1200);
  }, [applyPosition, stop]);

  useEffect(() => {
    if (enabled) start();
    else {
      stop();
      lastFix.current = null;
      setState({
        status: 'idle',
        mph: 0,
        accuracy: null,
        timestamp: null,
        speedSource: 'none',
      });
    }
    return stop;
  }, [enabled, start, stop]);

  return { ...state, start, stop, kph: state.mph / 0.621371, mphFromKph: kphToMph };
}
