import type { RevForgeVoiceConfig } from "./voiceTypes";
export class RevForgeVoice {
  constructor(context: AudioContext, destination: AudioNode);
  start(
    patch: RevForgeVoiceConfig,
    look: { masterVolume: number; engineVolume: number; musicVolume: number },
  ): Promise<void>;
  applyPatch(patch: RevForgeVoiceConfig): void;
  setLook(look: {
    masterVolume: number;
    engineVolume: number;
    musicVolume: number;
  }): void;
  update(state: {
    rpm: number;
    load: number;
    accel: number;
    shifting: boolean;
    overrun: boolean;
  }): void;
  dispose(): void;
  blip(): void;
}
