import { useCallback, useEffect, useRef, useState } from "react";
import { kphToMph } from "../audio";

export type GpsStatus =
  | "idle"
  | "requesting"
  | "waiting"
  | "live"
  | "stale"
  | "denied"
  | "unavailable"
  | "error";
export interface GpsState {
  status: GpsStatus;
  mph: number;
  accuracy: number | null;
  timestamp: number | null;
  errorMessage?: string;
}
export function useGeolocation(enabled: boolean) {
  const [state, setState] = useState<GpsState>({
    status: "idle",
    mph: 0,
    accuracy: null,
    timestamp: null,
  });
  const watchId = useRef<number | null>(null);
  const generation = useRef(0);
  const stop = useCallback(() => {
    generation.current++;
    if (watchId.current !== null && navigator.geolocation)
      navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
  }, []);
  const start = useCallback(() => {
    stop();
    if (!navigator.geolocation) {
      setState((s) => ({
        ...s,
        status: "unavailable",
        mph: 0,
        errorMessage: "Location is not supported. Demo mode is available.",
      }));
      return;
    }
    const request = generation.current;
    setState((s) => ({
      ...s,
      status: "requesting",
      mph: 0,
      timestamp: null,
      errorMessage: undefined,
    }));
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        if (request !== generation.current) return;
        const speed = pos.coords.speed;
        if (speed === null || !Number.isFinite(speed) || speed < 0) {
          setState({
            status: "waiting",
            mph: 0,
            accuracy: pos.coords.accuracy,
            timestamp: null,
            errorMessage: "Location received; waiting for a speed reading.",
          });
          return;
        }
        setState({
          status: Date.now() - pos.timestamp > 5000 ? "stale" : "live",
          mph: speed * 2.236936,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        });
      },
      (err) => {
        if (request !== generation.current) return;
        setState((s) => ({
          ...s,
          mph: 0,
          status: err.code === err.PERMISSION_DENIED ? "denied" : "waiting",
          errorMessage: err.message,
        }));
      },
      { enableHighAccuracy: true, maximumAge: 500, timeout: 8000 },
    );
  }, [stop]);
  useEffect(() => {
    if (enabled) start();
    else {
      stop();
      setState((s) => ({ ...s, status: "idle", mph: 0, timestamp: null }));
    }
    const timer = enabled
      ? window.setInterval(() => {
          setState((s) =>
            s.status === "live" &&
            s.timestamp !== null &&
            Date.now() - s.timestamp > 5000
              ? {
                  ...s,
                  status: "stale",
                  errorMessage:
                    "GPS signal is stale. Sound is returning to idle.",
                }
              : s,
          );
        }, 500)
      : undefined;
    return () => {
      stop();
      window.clearInterval(timer);
    };
  }, [enabled, start, stop]);
  return {
    ...state,
    start,
    stop,
    kph: state.mph / 0.621371,
    mphFromKph: kphToMph,
  };
}
