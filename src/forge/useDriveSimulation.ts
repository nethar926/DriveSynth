import {idleWander} from './flightProfile';
import { useEffect, useRef, useState } from "react";
import type { useAudioEngine } from "../hooks/useAudioEngine";
import type { useGeolocation } from "../hooks/useGeolocation";
import { createSimulation, stepSimulation, clamp } from "./simulation";
import type { Drivetrain, Controls } from "./simulation";

export function useDriveSimulation(
  audio: ReturnType<typeof useAudioEngine>,
  gps: ReturnType<typeof useGeolocation>,
  config: Drivetrain,
  source: Controls["source"],
  mode: Controls["mode"],
  pedal: number,
  brake: boolean,
  jitter: number,
) {
  const simulation = useRef(createSimulation(config));
  const queuedShift = useRef(0);
  const latest = useRef({ audio, gps, config, source, mode, pedal, brake, jitter });
  const [hud, setHud] = useState(() => createSimulation(config));
  useEffect(() => {
    latest.current = { audio, gps, config, source, mode, pedal, brake, jitter };
  }, [audio, gps, config, source, mode, pedal, brake, jitter]);
  useEffect(() => {
    simulation.current.gear = Math.min(simulation.current.gear, config.gears);
    simulation.current.rpm = config.idleRpm;
  }, [config]);
  useEffect(() => {
    Object.assign(simulation.current, createSimulation(latest.current.config));
    queuedShift.current = 0;
  }, [source]);
  useEffect(() => {
    let handle = 0,
      previous = performance.now(),
      published = 0;
    const frame = (now: number) => {
      const { audio, gps, config, source, mode, pedal, brake, jitter } = latest.current;
      const dt = Math.min(0.05, Math.max(0, (now - previous) / 1000));
      previous = now;
      if (audio.running && document.visibilityState === "visible") {
        const fresh =
          gps.status === "live" &&
          gps.timestamp !== null &&
          Date.now() - gps.timestamp < 5000;
        const previousGear = simulation.current.gear;
        stepSimulation(simulation.current, config, dt, {
          source,
          mode,
          pedal,
          brake,
          shift: queuedShift.current,
          gpsSpeed: fresh ? gps.mph / 2.236936 : null,
        });
        const state = simulation.current;
        if (state.gear > previousGear) audio.triggerUiCue("upshift");
        const throttle = source === "gps" ? state.load : pedal;
        audio.setDriving({
          speed: clamp(state.speedMps / 53.6448, 0, 1),
          throttle: state.shifting ? throttle * 0.3 : throttle,
          load: state.load,
          rpm: state.rpm + idleWander(now/1000,state.rpm,config.idleRpm,throttle,jitter),
          acceleration: state.accel,
          shifting: state.shifting,
          overrun: state.overrun,
          rpmNorm: clamp(
            (state.rpm - config.idleRpm) / (config.redline - config.idleRpm),
            0,
            1,
          ),
        });
      }
      queuedShift.current = 0;
      if (now - published > 80) {
        published = now;
        const s=simulation.current,o=latest.current;
        setHud({ ...s,rpm:s.rpm+(o.audio.running?idleWander(now/1000,s.rpm,o.config.idleRpm,o.source==='demo'?o.pedal:s.load,o.jitter):0) });
      }
      handle = requestAnimationFrame(frame);
    };
    handle = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(handle);
  }, []);
  return {
    simulation,
    hud,
    shift: (direction: number) => {
      queuedShift.current = direction;
    },
    neutral: () => {
      simulation.current.gear = 0;
    },
    reset: () => {
      Object.assign(
        simulation.current,
        createSimulation(latest.current.config),
      );
      queuedShift.current = 0;
    },
  };
}
