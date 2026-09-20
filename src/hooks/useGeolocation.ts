import { useCallback, useEffect, useRef, useState } from 'react';
import { kphToMph } from '../audio';

export type GpsStatus = 'idle' | 'requesting' | 'waiting' | 'live' | 'denied' | 'unavailable' | 'error';

export interface GpsState {
  status: GpsStatus;
  mph: number;
  accuracy: number | null;
  timestamp: number | null;
  errorMessage?: string;
}

export function useGeolocation(enabled: boolean) {
  const [state, setState] = useState<GpsState>({
    status: 'idle',
    mph: 0,
    accuracy: null,
    timestamp: null,
  });
  const watchId = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (watchId.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
  }, []);

  const start = useCallback(() => {
    if (!navigator.geolocation) {
      setState((s) => ({ ...s, status: 'unavailable', errorMessage: 'Geolocation not available' }));
      return;
    }
    stop();
    setState((s) => ({ ...s, status: 'requesting' }));

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const spd = pos.coords.speed; // m/s or null
        let mph = 0;
        if (spd != null && Number.isFinite(spd) && spd >= 0) {
          mph = spd * 2.236936;
        }
        setState({
          status: 'live',
          mph,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setState((s) => ({ ...s, status: 'denied', errorMessage: err.message }));
        } else {
          setState((s) => ({
            ...s,
            status: s.status === 'live' ? 'waiting' : 'waiting',
            errorMessage: err.message,
          }));
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 500,
        timeout: 10000,
      },
    );

    // If we don't get a fix quickly, show waiting
    setTimeout(() => {
      setState((s) => (s.status === 'requesting' ? { ...s, status: 'waiting' } : s));
    }, 800);
  }, [stop]);

  useEffect(() => {
    if (enabled) start();
    else {
      stop();
      setState((s) => ({ ...s, status: 'idle' }));
    }
    return stop;
  }, [enabled, start, stop]);

  return { ...state, start, stop, kph: state.mph / 0.621371, mphFromKph: kphToMph };
}
