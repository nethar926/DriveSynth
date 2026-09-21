import { useCallback, useEffect, useRef, useState } from "react";
import { speedFromFix, type Fix } from "./gpsSpeed";
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
  estimated?: boolean;
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
  const previous = useRef<Fix|null>(null);
  const stop = useCallback(() => {
    generation.current++;
    previous.current = null;
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
        const fix = {...pos.coords,latitude:pos.coords.latitude,longitude:pos.coords.longitude,accuracy:pos.coords.accuracy,speed:pos.coords.speed,timestamp:pos.timestamp};
        const {speed,estimated} = speedFromFix(fix,previous.current);
        if (!previous.current || pos.timestamp > previous.current.timestamp) previous.current=fix;
        if (speed === null || !Number.isFinite(speed) || speed < 0) {
          setState({
            status: "waiting",
            mph: 0,
            accuracy: pos.coords.accuracy,
            timestamp: null,
            errorMessage: "Location received; waiting for two accurate fixes to estimate speed.",
          });
          return;
        }
        setState({
          status: Date.now() - pos.timestamp > 10000 ? "stale" : "live",
          mph: speed * 2.236936,
          estimated,
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
            Date.now() - s.timestamp > 10000
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
