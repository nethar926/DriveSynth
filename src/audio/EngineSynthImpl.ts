import { defaultsForTopology, getBuiltin } from './builtins';
import type {
  DrivingInput,
  EngineDiag,
  EngineId,
  EngineParams,
  EnginePatch,
  EngineSynth,
  IceMode,
  SynthNodeDesc,
  TopologyId,
} from './types';
import { clamp, createNoiseBuffer, lerp, makeShaper, rpmCurve, smooth } from './utils';
import pulseWorkletUrl from './worklets/pulse-engine-processor.js?url';

type Kind = EnginePatch['kind'];

interface GraphHandles {
  master: GainNode;
  limiter: DynamicsCompressorNode;
  // shared
  noiseSrc?: AudioBufferSourceNode;
  pinkSrc?: AudioBufferSourceNode;
  // ICE oscillator path
  fund?: OscillatorNode;
  fund2?: OscillatorNode;
  fund3?: OscillatorNode;
  sub?: OscillatorNode;
  pulseLfo?: OscillatorNode;
  pulseGain?: GainNode;
  unevenLfo?: OscillatorNode;
  unevenGain?: GainNode;
  fundGain?: GainNode;
  subGain?: GainNode;
  mechGain?: GainNode;
  mechFilt?: BiquadFilterNode;
  presenceFilt?: BiquadFilterNode;
  muffler?: BiquadFilterNode;
  intakeGain?: GainNode;
  intakeFilt?: BiquadFilterNode;
  exhaustGain?: GainNode;
  ignGain?: GainNode;
  shaper?: WaveShaperNode;
  iceBus?: GainNode;
  // ICE worklet path
  pulseNode?: AudioWorkletNode;
  pulseGainOut?: GainNode;
  iceMode?: 'worklet' | 'osc';
  // EV
  whine1?: OscillatorNode;
  whine2?: OscillatorNode;
  whine3?: OscillatorNode;
  whineGain?: GainNode;
  buzzGain?: GainNode;
  buzzFilt?: BiquadFilterNode;
  // Sci-fi
  carrier1?: OscillatorNode;
  carrier2?: OscillatorNode;
  carrier3?: OscillatorNode;
  carrierGain?: GainNode;
  pulseMod?: OscillatorNode;
  pulseDepth?: GainNode;
  howlOsc?: OscillatorNode;
  howlOsc2?: OscillatorNode;
  howlFilt?: BiquadFilterNode;
  howlFilt2?: BiquadFilterNode;
  howlFilt3?: BiquadFilterNode;
  howlGain?: GainNode;
  formantGain?: GainNode;
  bodyGain?: GainNode;
  bodyFilt?: BiquadFilterNode;
  humOsc?: OscillatorNode;
  humGain?: GainNode;
  afterGain?: GainNode;
  wetHissGain?: GainNode;
  wetHissFilt?: BiquadFilterNode;
  wetHissFilt2?: BiquadFilterNode;
  wetAmLfo?: OscillatorNode;
  wetAmDepth?: GainNode;
  wetPan?: StereoPannerNode;
  delay?: DelayNode;
  delayGain?: GainNode;
  panL?: StereoPannerNode;
  panR?: StereoPannerNode;
  // Aerospace organic 4-bus
  spoolGain?: GainNode;
  compressorFilt?: BiquadFilterNode;
  compressorGain?: GainNode;
  intakeWhineOsc?: OscillatorNode;
  intakeWhineOsc2?: OscillatorNode;
  intakeWhineOsc3?: OscillatorNode;
  intakeWhineFilt?: BiquadFilterNode;
  intakeWhineGain?: GainNode;
  spoolFlutter?: OscillatorNode;
  spoolFlutterDepth?: GainNode;
  buzzSaw1?: OscillatorNode;
  buzzSaw2?: OscillatorNode;
  buzzSawGain?: GainNode;
  coreFilt?: BiquadFilterNode;
  coreFilt2?: BiquadFilterNode;
  coreGain?: GainNode;
  coreRoughLfo?: OscillatorNode;
  coreRoughDepth?: GainNode;
  jetRoarFilt?: BiquadFilterNode;
  jetRoarGain?: GainNode;
  afterFilt?: BiquadFilterNode;
  afterShaper?: WaveShaperNode;
  nozzleFilt?: BiquadFilterNode;
  nozzleGain?: GainNode;
  airframeFilt?: BiquadFilterNode;
  airframeGain?: GainNode;
  airframeLfo?: OscillatorNode;
  airframeAmDepth?: GainNode;
  // EV living / pack extras
  meshFilt?: BiquadFilterNode;
  meshGain?: GainNode;
  regenOsc?: OscillatorNode;
  regenOsc2?: OscillatorNode;
  regenFilt?: BiquadFilterNode;
  regenGain?: GainNode;
  motorFilt?: BiquadFilterNode;
  motorGain?: GainNode;
  dualWhineR?: OscillatorNode;
  dualWhineGainR?: GainNode;
  // ICE osc valvetrain tick
  tickGain?: GainNode;
  tickFilt?: BiquadFilterNode;
}

const workletContexts = new WeakSet<BaseAudioContext>();

export class EngineSynthImpl implements EngineSynth {
  readonly context: AudioContext;
  readonly output: GainNode;

  private _id: EngineId = 'v8-rumble';
  private patchMeta: EnginePatch;
  private params: EngineParams;
  private driving: DrivingInput = { speed: 0, throttle: 0, load: 0, reverse: false };
  private disposed = false;
  private g: GraphHandles;
  private hud = { rpmNorm: 0, loadFeel: 0, fundamentalHz: 55, driveMood: 'idle' };
  private whiteBuf: AudioBuffer;
  private pinkBuf: AudioBuffer;
  private workletPromise: Promise<boolean> | null = null;
  private workletError: string | undefined;
  private started = false;
  private customGraph: SynthNodeDesc[] | undefined;
  /** Living drive: lagged throttle/load (hysteresis) */
  private throttleLag = 0;
  private loadLag = 0;
  /** Aerospace spool inertia + wander */
  private spoolLag = 0;
  private spoolWander = 0;
  private abLag = 0;
  /** EV inverter detune wander */
  private evDetuneWander = 0;
  private prevThrottle = 0;
  private driveMood = 'idle';
  private liveJit = { filt: 0, gain: 0, pitch: 0 };
  private valveTickWait = 0;

  constructor(ctx: AudioContext, patch?: EnginePatch) {
    this.context = ctx;
    this.output = ctx.createGain();
    this.output.gain.value = 0;
    // Critical: without this, the graph never reaches the speakers (silent on all devices).
    this.output.connect(ctx.destination);

    this.whiteBuf = createNoiseBuffer(ctx, 2, false);
    this.pinkBuf = createNoiseBuffer(ctx, 2, true);

    const initial = patch ?? getBuiltin('v8-rumble')!;
    this.patchMeta = { ...initial, params: { ...initial.params } };
    this._id = initial.id;
    this.customGraph = initial.graph ? [...initial.graph] : undefined;
    this.params = {
      ...defaultsForTopology(initial.topology),
      ...(initial.params as EngineParams),
    };
    if (this.customGraph?.length) {
      this.applyGraphToParams(this.customGraph);
    }

    this.g = this.buildGraph(initial.kind, initial.topology);
    this.applyAllParams();
    this.applyDriving(true);
  }

  get id(): EngineId {
    return this._id;
  }

  async start(): Promise<void> {
    if (this.disposed) return;
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
    // iOS Safari: a tiny buffer play inside the user-gesture stack helps unlock audio.
    try {
      const unlock = this.context.createBuffer(1, 1, this.context.sampleRate);
      const src = this.context.createBufferSource();
      src.buffer = unlock;
      src.connect(this.context.destination);
      src.start(0);
    } catch {
      /* ignore unlock helper failures */
    }

    if (this.patchMeta.kind === 'ice') {
      await this.ensurePulseWorklet();
    }

    smooth(this.output.gain, 1, 0.08, this.context);
    this.started = true;
    // Unmistakable idle chuff/tick through the same output → destination bus
    // so the user knows audio unlocked even at speed=0 throttle=0.
    this.playIdleChuff();
  }

  stop(): void {
    this.started = false;
    smooth(this.output.gain, 0, 0.12, this.context);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.started = false;
    try {
      this.teardownGraph();
      this.output.disconnect();
    } catch {
      /* ignore */
    }
  }

  setDriving(d: DrivingInput): void {
    this.driving = {
      speed: clamp(d.speed),
      throttle: clamp(d.throttle),
      load: d.load !== undefined ? clamp(d.load, -1, 1) : this.driving.load,
      reverse: !!d.reverse,
    };
    this.applyDriving(false);
  }

  setParams(p: Partial<EngineParams>): void {
    this.params = { ...this.params, ...p };
    this.applyAllParams();
    this.applyDriving(false);
  }

  getParams(): EngineParams {
    return { ...this.params };
  }

  toPatch(): EnginePatch {
    return {
      version: 0,
      id: this._id,
      name: this.patchMeta.name,
      kind: this.patchMeta.kind,
      topology: this.patchMeta.topology,
      params: { ...this.params } as Record<string, number | string>,
      graph: this.customGraph ? [...this.customGraph] : undefined,
      meta: {
        ...this.patchMeta.meta,
        createdAt: new Date().toISOString(),
      },
    };
  }

  fromPatch(patch: EnginePatch): void {
    const kindChanged =
      patch.kind !== this.patchMeta.kind || patch.topology !== this.patchMeta.topology;
    this.patchMeta = { ...patch, params: { ...patch.params } };
    this._id = patch.id;
    this.customGraph = patch.graph ? [...patch.graph] : undefined;
    this.params = {
      ...defaultsForTopology(patch.topology),
      ...(patch.params as EngineParams),
    };
    if (this.customGraph?.length) {
      this.applyGraphToParams(this.customGraph);
    }
    if (kindChanged) {
      this.teardownGraph();
      this.g = this.buildGraph(patch.kind, patch.topology);
    }
    this.applyAllParams();
    this.applyDriving(true);
    if (patch.kind === 'ice' && this.context.state === 'running') {
      void this.ensurePulseWorklet();
    }
  }

  getHud() {
    return { ...this.hud, driveMood: this.driveMood };
  }

  getDiag(): EngineDiag {
    const kind = this.patchMeta.kind;
    let iceMode: IceMode = 'n/a';
    if (kind === 'ice') {
      iceMode = this.g.iceMode ?? 'osc';
    }
    const diag: EngineDiag = {
      contextState: this.context.state,
      iceMode,
      running: this.started && !this.disposed,
      engineId: this._id,
    };
    if (this.workletError) diag.workletError = this.workletError;
    return diag;
  }

  /**
   * Short unmistakable confirmation through output → destination.
   * 1–2 combustion-ish pulses (or soft click) so silence after Start is diagnosable.
   */
  private playIdleChuff(): void {
    if (this.disposed) return;
    const ctx = this.context;
    const now = ctx.currentTime;
    // Soft organic chuffs: filtered noise body + triangle thump (no saw lead)
    for (let i = 0; i < 2; i++) {
      const t0 = now + 0.04 + i * 0.095;
      try {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = 72 - i * 11;

        const filt = ctx.createBiquadFilter();
        filt.type = 'lowpass';
        filt.frequency.value = 520 - i * 80;
        filt.Q.value = 0.8;

        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.28, t0 + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.1);

        osc.connect(filt);
        filt.connect(g);
        g.connect(this.output);

        const noise = ctx.createBufferSource();
        noise.buffer = this.pinkBuf;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 280 + i * 40;
        bp.Q.value = 1.2;
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.0001, t0);
        ng.gain.exponentialRampToValueAtTime(0.32, t0 + 0.008);
        ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.085);
        noise.connect(bp);
        bp.connect(ng);
        ng.connect(this.output);

        osc.start(t0);
        osc.stop(t0 + 0.11);
        noise.start(t0);
        noise.stop(t0 + 0.09);

        osc.onended = () => {
          try {
            osc.disconnect();
            filt.disconnect();
            g.disconnect();
          } catch {
            /* ignore */
          }
        };
        noise.onended = () => {
          try {
            noise.disconnect();
            bp.disconnect();
            ng.disconnect();
          } catch {
            /* ignore */
          }
        };
      } catch {
        /* ignore chuff failures — never block start */
      }
    }
  }

  /** Map builder graph node params onto live EngineParams (v1 interpreter). */
  applyGraphToParams(graph: SynthNodeDesc[]): void {
    this.customGraph = [...graph];
    const mapped: Partial<EngineParams> = {};
    for (const node of graph) {
      const p = node.params;
      switch (node.type) {
        case 'PulseTrain':
          if (p.cylinders !== undefined) mapped.cylinders = Number(p.cylinders) as EngineParams['cylinders'];
          if (p.pulseWidth !== undefined) mapped.pulseWidth = Number(p.pulseWidth);
          if (p.pulseJitter !== undefined) mapped.pulseJitter = Number(p.pulseJitter);
          if (p.roughness !== undefined) mapped.roughness = Number(p.roughness);
          break;
        case 'ExhaustWaveguide':
          if (p.exhaustLength !== undefined) mapped.exhaustLength = Number(p.exhaustLength);
          if (p.exhaustFeedback !== undefined) mapped.exhaustFeedback = Number(p.exhaustFeedback);
          if (p.muffling !== undefined) mapped.muffling = Number(p.muffling);
          if (p.growl !== undefined) mapped.growl = Number(p.growl);
          break;
        case 'IntakeNoise':
          if (p.intake !== undefined) mapped.intake = Number(p.intake);
          break;
        case 'Mechanical':
          if (p.roughness !== undefined) mapped.roughness = Number(p.roughness);
          break;
        case 'FormantHowl':
          if (p.formantHowl !== undefined) mapped.formantHowl = Number(p.formantHowl);
          if (p.formantSpread !== undefined) mapped.formantSpread = Number(p.formantSpread);
          if (p.resonance !== undefined) mapped.resonance = Number(p.resonance);
          break;
        case 'WetRoadNoise':
          if (p.wetHiss !== undefined) mapped.wetHiss = Number(p.wetHiss);
          if (p.doppler !== undefined) mapped.doppler = Number(p.doppler);
          break;
        case 'TurbineSpool':
          if (p.spoolPitch !== undefined) mapped.spoolPitch = Number(p.spoolPitch);
          if (p.turbine !== undefined) mapped.turbine = Number(p.turbine);
          if (p.idleSpool !== undefined) mapped.idleSpool = Number(p.idleSpool);
          break;
        case 'IntakeWhine':
          if (p.intakeWhine !== undefined) mapped.intakeWhine = Number(p.intakeWhine);
          break;
        case 'Afterburner':
          if (p.afterburn !== undefined) mapped.afterburn = Number(p.afterburn);
          if (p.jetScream !== undefined) mapped.jetScream = Number(p.jetScream);
          break;
        case 'CompressorStage':
          if (p.compressor !== undefined) mapped.compressor = Number(p.compressor);
          if (p.jetRoar !== undefined) mapped.jetRoar = Number(p.jetRoar);
          break;
        case 'Gain':
        case 'gain':
          if (p.gain !== undefined) mapped.masterGain = clamp(Number(p.gain));
          break;
        default:
          break;
      }
    }
    this.params = { ...this.params, ...mapped };
    this.applyAllParams();
    this.applyDriving(false);
  }

  /* ---------- worklet ---------- */

  private async ensurePulseWorklet(): Promise<boolean> {
    if (this.disposed || this.patchMeta.kind !== 'ice') return false;
    if (this.g.iceMode === 'worklet' && this.g.pulseNode) return true;
    if (this.workletPromise) return this.workletPromise;

    this.workletPromise = (async () => {
      try {
        if (!workletContexts.has(this.context)) {
          const url = pulseWorkletUrl.startsWith('http')
            ? pulseWorkletUrl
            : new URL(pulseWorkletUrl, window.location.href).href;
          // Prefer public path fallback for Tesla / file:// quirks
          try {
            await this.context.audioWorklet.addModule(url);
          } catch {
            const base = import.meta.env.BASE_URL || './';
            await this.context.audioWorklet.addModule(`${base}worklets/pulse-engine-processor.js`);
          }
          workletContexts.add(this.context);
        }

        const node = new AudioWorkletNode(this.context, 'pulse-engine-processor', {
          numberOfInputs: 0,
          numberOfOutputs: 1,
          outputChannelCount: [2],
        });

        const pulseGainOut = this.context.createGain();
        pulseGainOut.gain.value = 1;
        node.connect(pulseGainOut);
        pulseGainOut.connect(this.g.master);

        // Mute oscillator ICE bus if present
        if (this.g.iceBus) {
          smooth(this.g.iceBus.gain, 0, 0.05, this.context);
        }

        this.g.pulseNode = node;
        this.g.pulseGainOut = pulseGainOut;
        this.g.iceMode = 'worklet';
        this.workletError = undefined;
        this.applyAllParams();
        this.applyDriving(true);
        return true;
      } catch (err) {
        console.warn('[DriveSynth] pulse worklet unavailable, using oscillator ICE', err);
        this.g.iceMode = 'osc';
        this.workletError =
          err instanceof Error ? err.message : typeof err === 'string' ? err : 'worklet load failed';
        return false;
      } finally {
        this.workletPromise = null;
      }
    })();

    return this.workletPromise;
  }

  /* ---------- graph build ---------- */

  private buildGraph(kind: Kind, _topology: TopologyId): GraphHandles {
    const ctx = this.context;
    const master = ctx.createGain();
    master.gain.value = 0.7;

    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 8;
    limiter.ratio.value = 8;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.12;

    master.connect(limiter);
    limiter.connect(this.output);

    const g: GraphHandles = {
      master,
      limiter,
      iceMode: kind === 'ice' ? 'osc' : undefined,
    };

    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = this.whiteBuf;
    noiseSrc.loop = true;
    noiseSrc.start();
    g.noiseSrc = noiseSrc;

    const pinkSrc = ctx.createBufferSource();
    pinkSrc.buffer = this.pinkBuf;
    pinkSrc.loop = true;
    pinkSrc.start();
    g.pinkSrc = pinkSrc;

    if (kind === 'ice') {
      this.buildIce(g);
    } else if (kind === 'ev-whine') {
      this.buildEv(g);
    } else if (kind === 'aerospace') {
      this.buildAerospace(g);
    } else {
      this.buildScifi(g);
    }

    return g;
  }

  private buildIce(g: GraphHandles): void {
    const ctx = this.context;

    // Organic ICE osc fallback: noise + soft pulse imitation — NO triple saw/square lead.
    // Buses mirror worklet: mechanical bed, combustion pulses, intake, exhaust waveguide body.
    const iceBus = ctx.createGain();
    iceBus.gain.value = 1;
    g.iceBus = iceBus;

    const muffler = ctx.createBiquadFilter();
    muffler.type = 'lowpass';
    muffler.frequency.value = 2200;
    muffler.Q.value = 0.65;
    g.muffler = muffler;

    const mechDeep = ctx.createBiquadFilter();
    mechDeep.type = 'lowpass';
    mechDeep.frequency.value = 140;
    mechDeep.Q.value = 0.7;

    const mechFilt = ctx.createBiquadFilter();
    mechFilt.type = 'bandpass';
    mechFilt.frequency.value = 700;
    mechFilt.Q.value = 1.8;
    g.mechFilt = mechFilt;

    const mechGain = ctx.createGain();
    mechGain.gain.value = 0.16;
    g.mechGain = mechGain;

    g.pinkSrc!.connect(mechDeep);
    mechDeep.connect(mechGain);
    g.pinkSrc!.connect(mechFilt);
    mechFilt.connect(mechGain);

    const unevenLfo = ctx.createOscillator();
    unevenLfo.type = 'sine';
    unevenLfo.frequency.value = 3.2;
    unevenLfo.start();
    g.unevenLfo = unevenLfo;

    const unevenGain = ctx.createGain();
    unevenGain.gain.value = 0.08;
    g.unevenGain = unevenGain;
    unevenLfo.connect(unevenGain);
    unevenGain.connect(mechGain.gain);

    const fundGain = ctx.createGain();
    fundGain.gain.value = 0.12;
    g.fundGain = fundGain;

    const fund = ctx.createOscillator();
    fund.type = 'triangle';
    fund.frequency.value = 55;
    fund.start();
    g.fund = fund;

    const fund2 = ctx.createOscillator();
    fund2.type = 'triangle';
    fund2.frequency.value = 27.5;
    fund2.detune.value = 5;
    fund2.start();
    g.fund2 = fund2;

    g.fund3 = undefined;

    const shaper = ctx.createWaveShaper();
    shaper.curve = makeShaper(0.22) as Float32Array<ArrayBuffer>;
    shaper.oversample = '2x';
    g.shaper = shaper;

    const bodyLp = ctx.createBiquadFilter();
    bodyLp.type = 'lowpass';
    bodyLp.frequency.value = 480;
    bodyLp.Q.value = 0.8;

    const fundMix = ctx.createGain();
    fundMix.gain.value = 0.55;
    fund.connect(bodyLp);
    fund2.connect(bodyLp);
    bodyLp.connect(shaper);
    shaper.connect(fundMix);
    fundMix.connect(fundGain);

    const pulseBp = ctx.createBiquadFilter();
    pulseBp.type = 'bandpass';
    pulseBp.frequency.value = 380;
    pulseBp.Q.value = 1.4;
    g.presenceFilt = pulseBp;

    const pulseNoiseGain = ctx.createGain();
    pulseNoiseGain.gain.value = 0.2;
    g.pinkSrc!.connect(pulseBp);
    pulseBp.connect(pulseNoiseGain);
    pulseNoiseGain.connect(fundGain);

    const pulseLfo = ctx.createOscillator();
    pulseLfo.type = 'sine';
    pulseLfo.frequency.value = 8;
    pulseLfo.start();
    g.pulseLfo = pulseLfo;

    const pulseGain = ctx.createGain();
    pulseGain.gain.value = 0.14;
    g.pulseGain = pulseGain;
    pulseLfo.connect(pulseGain);
    pulseGain.connect(fundGain.gain);

    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = 55;
    sub.start();
    g.sub = sub;

    const subGain = ctx.createGain();
    subGain.gain.value = 0.18;
    g.subGain = subGain;
    sub.connect(subGain);
    subGain.connect(muffler);

    fundGain.connect(muffler);

    const intakeFilt = ctx.createBiquadFilter();
    intakeFilt.type = 'bandpass';
    intakeFilt.frequency.value = 1600;
    intakeFilt.Q.value = 0.7;
    g.intakeFilt = intakeFilt;

    const intakeGain = ctx.createGain();
    intakeGain.gain.value = 0;
    g.intakeGain = intakeGain;

    g.noiseSrc!.connect(intakeFilt);
    intakeFilt.connect(intakeGain);
    intakeGain.connect(muffler);

    const exhaustFilt = ctx.createBiquadFilter();
    exhaustFilt.type = 'lowpass';
    exhaustFilt.frequency.value = 220;
    exhaustFilt.Q.value = 0.85;

    const exhaustGain = ctx.createGain();
    exhaustGain.gain.value = 0.28;
    g.exhaustGain = exhaustGain;

    const delay = ctx.createDelay(0.08);
    delay.delayTime.value = 0.018;
    g.delay = delay;

    const delayGain = ctx.createGain();
    delayGain.gain.value = 0.45;
    g.delayGain = delayGain;

    g.pinkSrc!.connect(exhaustFilt);
    exhaustFilt.connect(exhaustGain);
    exhaustGain.connect(delay);
    delay.connect(delayGain);
    delayGain.connect(delay);
    delay.connect(muffler);
    exhaustGain.connect(muffler);

    const ignFilt = ctx.createBiquadFilter();
    ignFilt.type = 'highpass';
    ignFilt.frequency.value = 2200;

    const ignGain = ctx.createGain();
    ignGain.gain.value = 0.03;
    g.ignGain = ignGain;

    g.noiseSrc!.connect(ignFilt);
    ignFilt.connect(ignGain);

    // Sparse valvetrain tick (gated in applyIceDriving)
    const tickFilt = ctx.createBiquadFilter();
    tickFilt.type = 'bandpass';
    tickFilt.frequency.value = 3200;
    tickFilt.Q.value = 4;
    g.tickFilt = tickFilt;
    const tickGain = ctx.createGain();
    tickGain.gain.value = 0.001;
    g.tickGain = tickGain;
    g.noiseSrc!.connect(tickFilt);
    tickFilt.connect(tickGain);
    tickGain.connect(muffler);
    ignGain.connect(muffler);

    mechGain.connect(muffler);

    const pan = ctx.createStereoPanner();
    pan.pan.value = 0;
    g.panL = pan;

    muffler.connect(pan);
    pan.connect(iceBus);
    iceBus.connect(g.master);
  }

  private buildEv(g: GraphHandles): void {
    const ctx = this.context;
    const topo = this.patchMeta.topology;

    const whineGain = ctx.createGain();
    whineGain.gain.value = 0.25;
    g.whineGain = whineGain;

    const w1 = ctx.createOscillator();
    w1.type = 'sine';
    w1.frequency.value = 180;
    w1.start();
    g.whine1 = w1;

    const w2 = ctx.createOscillator();
    w2.type = 'sine';
    w2.frequency.value = 360;
    w2.start();
    g.whine2 = w2;

    const w3 = ctx.createOscillator();
    w3.type = 'triangle';
    w3.frequency.value = 540;
    w3.start();
    g.whine3 = w3;

    const mix = ctx.createGain();
    mix.gain.value = 1;
    w1.connect(mix);
    w2.connect(mix);
    w3.connect(mix);
    mix.connect(whineGain);

    const muffler = ctx.createBiquadFilter();
    muffler.type = 'lowpass';
    muffler.frequency.value = 6000;
    muffler.Q.value = 0.5;
    g.muffler = muffler;

    whineGain.connect(muffler);

    const buzzFilt = ctx.createBiquadFilter();
    buzzFilt.type = 'bandpass';
    buzzFilt.frequency.value = 4000;
    buzzFilt.Q.value = 4;
    g.buzzFilt = buzzFilt;

    const buzzGain = ctx.createGain();
    buzzGain.gain.value = 0.08;
    g.buzzGain = buzzGain;

    g.noiseSrc!.connect(buzzFilt);
    buzzFilt.connect(buzzGain);
    buzzGain.connect(muffler);

    // Gear mesh bed (climb / general)
    const meshFilt = ctx.createBiquadFilter();
    meshFilt.type = 'bandpass';
    meshFilt.frequency.value = 1200;
    meshFilt.Q.value = 2.2;
    g.meshFilt = meshFilt;
    const meshGain = ctx.createGain();
    meshGain.gain.value = 0;
    g.meshGain = meshGain;
    g.noiseSrc!.connect(meshFilt);
    meshFilt.connect(meshGain);
    meshGain.connect(muffler);

    // Regen howl layer (high thin whistle)
    const regenOsc = ctx.createOscillator();
    regenOsc.type = 'sine';
    regenOsc.frequency.value = 1400;
    regenOsc.start();
    g.regenOsc = regenOsc;
    const regenOsc2 = ctx.createOscillator();
    regenOsc2.type = 'triangle';
    regenOsc2.frequency.value = 2100;
    regenOsc2.detune.value = 9;
    regenOsc2.start();
    g.regenOsc2 = regenOsc2;
    const regenFilt = ctx.createBiquadFilter();
    regenFilt.type = 'bandpass';
    regenFilt.frequency.value = 1800;
    regenFilt.Q.value = 7;
    g.regenFilt = regenFilt;
    const regenGain = ctx.createGain();
    regenGain.gain.value = 0;
    g.regenGain = regenGain;
    regenOsc.connect(regenFilt);
    regenOsc2.connect(regenFilt);
    regenFilt.connect(regenGain);
    regenGain.connect(muffler);

    // Dense mid motor roar (dual-motor / body)
    const motorFilt = ctx.createBiquadFilter();
    motorFilt.type = 'lowpass';
    motorFilt.frequency.value = 900;
    motorFilt.Q.value = 0.7;
    g.motorFilt = motorFilt;
    const motorGain = ctx.createGain();
    motorGain.gain.value = topo === 'ev-dual-motor' ? 0.22 : 0.04;
    g.motorGain = motorGain;
    g.pinkSrc!.connect(motorFilt);
    motorFilt.connect(motorGain);

    if (topo === 'ev-dual-motor') {
      // Split L/R inverter beat
      const panL = ctx.createStereoPanner();
      panL.pan.value = -0.55;
      g.panL = panL;
      const panR = ctx.createStereoPanner();
      panR.pan.value = 0.55;
      g.panR = panR;

      const dualR = ctx.createOscillator();
      dualR.type = 'sine';
      dualR.frequency.value = 188;
      dualR.detune.value = 14;
      dualR.start();
      g.dualWhineR = dualR;
      const dualGainR = ctx.createGain();
      dualGainR.gain.value = 0.18;
      g.dualWhineGainR = dualGainR;
      dualR.connect(dualGainR);

      muffler.connect(panL);
      dualGainR.connect(panR);
      motorGain.connect(panL);
      motorGain.connect(panR);
      panL.connect(g.master);
      panR.connect(g.master);
    } else {
      const pan = ctx.createStereoPanner();
      pan.pan.value = 0;
      g.panL = pan;
      muffler.connect(pan);
      motorGain.connect(pan);
      pan.connect(g.master);
    }
  }


  private buildAerospace(g: GraphHandles): void {
    const ctx = this.context;

    // ——— Bus 1: Spool / compressor ———
    // Band-limited noise dominates; mild detuned BPF whine buried underneath.
    const spoolBus = ctx.createGain();
    spoolBus.gain.value = 1;
    g.spoolGain = spoolBus;

    const compressorFilt = ctx.createBiquadFilter();
    compressorFilt.type = 'bandpass';
    compressorFilt.frequency.value = 1800;
    compressorFilt.Q.value = 1.6;
    g.compressorFilt = compressorFilt;

    const compressorGain = ctx.createGain();
    compressorGain.gain.value = 0.18;
    g.compressorGain = compressorGain;

    g.noiseSrc!.connect(compressorFilt);
    compressorFilt.connect(compressorGain);
    compressorGain.connect(spoolBus);

    // Mild irregular whine (sine/triangle only — no saw/square identity)
    const intakeWhineFilt = ctx.createBiquadFilter();
    intakeWhineFilt.type = 'bandpass';
    intakeWhineFilt.frequency.value = 2100;
    intakeWhineFilt.Q.value = 6;
    g.intakeWhineFilt = intakeWhineFilt;

    const intakeWhineGain = ctx.createGain();
    intakeWhineGain.gain.value = 0.035;
    g.intakeWhineGain = intakeWhineGain;

    const whine1 = ctx.createOscillator();
    whine1.type = 'sine';
    whine1.frequency.value = 420;
    whine1.start();
    g.intakeWhineOsc = whine1;

    const whine2 = ctx.createOscillator();
    whine2.type = 'sine';
    whine2.frequency.value = 428;
    whine2.detune.value = 7;
    whine2.start();
    g.intakeWhineOsc2 = whine2;

    const whine3 = ctx.createOscillator();
    whine3.type = 'triangle';
    whine3.frequency.value = 845;
    whine3.detune.value = -11;
    whine3.start();
    g.intakeWhineOsc3 = whine3;

    const whineMix = ctx.createGain();
    whineMix.gain.value = 0.55;
    whine1.connect(whineMix);
    whine2.connect(whineMix);
    whine3.connect(whineMix);

    const flutter = ctx.createOscillator();
    flutter.type = 'sine';
    flutter.frequency.value = 2.4;
    flutter.start();
    g.spoolFlutter = flutter;
    const flutterDepth = ctx.createGain();
    flutterDepth.gain.value = 0.22;
    g.spoolFlutterDepth = flutterDepth;
    const whineAm = ctx.createGain();
    whineAm.gain.value = 0.7;
    flutter.connect(flutterDepth);
    flutterDepth.connect(whineAm.gain);
    whineMix.connect(whineAm);
    whineAm.connect(intakeWhineFilt);
    intakeWhineFilt.connect(intakeWhineGain);
    intakeWhineGain.connect(spoolBus);

    const buzzSawGain = ctx.createGain();
    buzzSawGain.gain.value = 0;
    g.buzzSawGain = buzzSawGain;
    const bs1 = ctx.createOscillator();
    bs1.type = 'sine';
    bs1.frequency.value = 980;
    bs1.start();
    g.buzzSaw1 = bs1;
    const bs2 = ctx.createOscillator();
    bs2.type = 'sine';
    bs2.frequency.value = 1470;
    bs2.detune.value = 5;
    bs2.start();
    g.buzzSaw2 = bs2;
    bs1.connect(buzzSawGain);
    bs2.connect(buzzSawGain);
    buzzSawGain.connect(spoolBus);

    // ——— Bus 2: Core ———
    const coreFilt = ctx.createBiquadFilter();
    coreFilt.type = 'lowpass';
    coreFilt.frequency.value = 1100;
    coreFilt.Q.value = 0.65;
    g.coreFilt = coreFilt;

    const coreFilt2 = ctx.createBiquadFilter();
    coreFilt2.type = 'bandpass';
    coreFilt2.frequency.value = 380;
    coreFilt2.Q.value = 0.9;
    g.coreFilt2 = coreFilt2;

    const coreGain = ctx.createGain();
    coreGain.gain.value = 0.28;
    g.coreGain = coreGain;

    const coreRoughLfo = ctx.createOscillator();
    coreRoughLfo.type = 'sine';
    coreRoughLfo.frequency.value = 1.7;
    coreRoughLfo.start();
    g.coreRoughLfo = coreRoughLfo;
    const coreRoughDepth = ctx.createGain();
    coreRoughDepth.gain.value = 0.12;
    g.coreRoughDepth = coreRoughDepth;
    const coreAm = ctx.createGain();
    coreAm.gain.value = 0.85;
    coreRoughLfo.connect(coreRoughDepth);
    coreRoughDepth.connect(coreAm.gain);

    g.pinkSrc!.connect(coreFilt);
    coreFilt.connect(coreFilt2);
    coreFilt2.connect(coreAm);
    coreAm.connect(coreGain);

    // ——— Bus 3: Exhaust / AB ———
    const jetRoarFilt = ctx.createBiquadFilter();
    jetRoarFilt.type = 'lowpass';
    jetRoarFilt.frequency.value = 420;
    jetRoarFilt.Q.value = 0.55;
    g.jetRoarFilt = jetRoarFilt;

    const jetRoarGain = ctx.createGain();
    jetRoarGain.gain.value = 0.22;
    g.jetRoarGain = jetRoarGain;

    g.pinkSrc!.connect(jetRoarFilt);
    jetRoarFilt.connect(jetRoarGain);

    const afterFilt = ctx.createBiquadFilter();
    afterFilt.type = 'bandpass';
    afterFilt.frequency.value = 900;
    afterFilt.Q.value = 0.8;
    g.afterFilt = afterFilt;

    const afterShaper = ctx.createWaveShaper();
    afterShaper.curve = makeShaper(0.35) as Float32Array<ArrayBuffer>;
    g.afterShaper = afterShaper;

    const afterGain = ctx.createGain();
    afterGain.gain.value = 0;
    g.afterGain = afterGain;

    g.noiseSrc!.connect(afterFilt);
    afterFilt.connect(afterShaper);
    afterShaper.connect(afterGain);

    const nozzleFilt = ctx.createBiquadFilter();
    nozzleFilt.type = 'highpass';
    nozzleFilt.frequency.value = 4500;
    nozzleFilt.Q.value = 0.7;
    g.nozzleFilt = nozzleFilt;

    const nozzleGain = ctx.createGain();
    nozzleGain.gain.value = 0;
    g.nozzleGain = nozzleGain;

    g.noiseSrc!.connect(nozzleFilt);
    nozzleFilt.connect(nozzleGain);

    // ——— Bus 4: Airframe ———
    const airframeFilt = ctx.createBiquadFilter();
    airframeFilt.type = 'lowpass';
    airframeFilt.frequency.value = 70;
    airframeFilt.Q.value = 0.8;
    g.airframeFilt = airframeFilt;

    const airframeGain = ctx.createGain();
    airframeGain.gain.value = 0.05;
    g.airframeGain = airframeGain;

    const airframeLfo = ctx.createOscillator();
    airframeLfo.type = 'sine';
    airframeLfo.frequency.value = 0.85;
    airframeLfo.start();
    g.airframeLfo = airframeLfo;
    const airframeAmDepth = ctx.createGain();
    airframeAmDepth.gain.value = 0.35;
    g.airframeAmDepth = airframeAmDepth;
    const airAm = ctx.createGain();
    airAm.gain.value = 0.7;
    airframeLfo.connect(airframeAmDepth);
    airframeAmDepth.connect(airAm.gain);

    g.pinkSrc!.connect(airframeFilt);
    airframeFilt.connect(airAm);
    airAm.connect(airframeGain);

    const sum = ctx.createGain();
    sum.gain.value = 1;
    spoolBus.connect(sum);
    coreGain.connect(sum);
    jetRoarGain.connect(sum);
    afterGain.connect(sum);
    nozzleGain.connect(sum);
    airframeGain.connect(sum);

    const panL = ctx.createStereoPanner();
    panL.pan.value = -0.22;
    g.panL = panL;
    const panR = ctx.createStereoPanner();
    panR.pan.value = 0.22;
    g.panR = panR;

    const splitL = ctx.createGain();
    splitL.gain.value = 0.72;
    const splitR = ctx.createGain();
    splitR.gain.value = 0.72;
    sum.connect(splitL);
    sum.connect(splitR);
    splitL.connect(panL);
    splitR.connect(panR);
    panL.connect(g.master);
    panR.connect(g.master);
  }


  private buildScifi(g: GraphHandles): void {
    const ctx = this.context;

    // noise body
    const bodyFilt = ctx.createBiquadFilter();
    bodyFilt.type = 'bandpass';
    bodyFilt.frequency.value = 400;
    bodyFilt.Q.value = 2.5;
    g.bodyFilt = bodyFilt;

    const bodyGain = ctx.createGain();
    bodyGain.gain.value = 0.35;
    g.bodyGain = bodyGain;

    g.pinkSrc!.connect(bodyFilt);
    bodyFilt.connect(bodyGain);

    // pulsed carriers
    const carrierGain = ctx.createGain();
    carrierGain.gain.value = 0.22;
    g.carrierGain = carrierGain;

    const c1 = ctx.createOscillator();
    c1.type = 'sawtooth';
    c1.frequency.value = 110;
    c1.start();
    g.carrier1 = c1;

    const c2 = ctx.createOscillator();
    c2.type = 'square';
    c2.frequency.value = 110;
    c2.detune.value = -12;
    c2.start();
    g.carrier2 = c2;

    const c3 = ctx.createOscillator();
    c3.type = 'sawtooth';
    c3.frequency.value = 165;
    c3.detune.value = 18;
    c3.start();
    g.carrier3 = c3;

    const bite = ctx.createWaveShaper();
    bite.curve = makeShaper(0.55) as Float32Array<ArrayBuffer>;
    c1.connect(bite);
    c2.connect(bite);
    c3.connect(bite);
    bite.connect(carrierGain);

    const pulseMod = ctx.createOscillator();
    pulseMod.type = 'sine';
    pulseMod.frequency.value = 6;
    pulseMod.start();
    g.pulseMod = pulseMod;

    const pulseDepth = ctx.createGain();
    pulseDepth.gain.value = 0.18;
    g.pulseDepth = pulseDepth;
    pulseMod.connect(pulseDepth);
    pulseDepth.connect(carrierGain.gain);

    // Multi-formant howl — “elephant slowed” via moving formants (no samples)
    const howlOsc = ctx.createOscillator();
    howlOsc.type = 'sawtooth';
    howlOsc.frequency.value = 220;
    howlOsc.start();
    g.howlOsc = howlOsc;

    const howlOsc2 = ctx.createOscillator();
    howlOsc2.type = 'sawtooth';
    howlOsc2.frequency.value = 330;
    howlOsc2.detune.value = -18;
    howlOsc2.start();
    g.howlOsc2 = howlOsc2;

    const howlFilt = ctx.createBiquadFilter();
    howlFilt.type = 'bandpass';
    howlFilt.frequency.value = 480;
    howlFilt.Q.value = 10;
    g.howlFilt = howlFilt;

    const howlFilt2 = ctx.createBiquadFilter();
    howlFilt2.type = 'peaking';
    howlFilt2.frequency.value = 920;
    howlFilt2.Q.value = 6;
    howlFilt2.gain.value = 10;
    g.howlFilt2 = howlFilt2;

    const howlFilt3 = ctx.createBiquadFilter();
    howlFilt3.type = 'bandpass';
    howlFilt3.frequency.value = 1600;
    howlFilt3.Q.value = 8;
    g.howlFilt3 = howlFilt3;

    const formantGain = ctx.createGain();
    formantGain.gain.value = 0;
    g.formantGain = formantGain;

    const howlGain = ctx.createGain();
    howlGain.gain.value = 0;
    g.howlGain = howlGain;

    howlOsc.connect(howlFilt);
    howlOsc2.connect(howlFilt);
    howlFilt.connect(howlFilt2);
    howlFilt2.connect(howlFilt3);
    howlFilt3.connect(formantGain);
    formantGain.connect(howlGain);

    // Wet-road hiss: highpass/bandpass noise + AM + stereo smear
    const wetHissFilt = ctx.createBiquadFilter();
    wetHissFilt.type = 'highpass';
    wetHissFilt.frequency.value = 1800;
    wetHissFilt.Q.value = 0.7;
    g.wetHissFilt = wetHissFilt;

    const wetHissFilt2 = ctx.createBiquadFilter();
    wetHissFilt2.type = 'bandpass';
    wetHissFilt2.frequency.value = 4200;
    wetHissFilt2.Q.value = 1.4;
    g.wetHissFilt2 = wetHissFilt2;

    const wetHissGain = ctx.createGain();
    wetHissGain.gain.value = 0;
    g.wetHissGain = wetHissGain;

    const wetAmLfo = ctx.createOscillator();
    wetAmLfo.type = 'sine';
    wetAmLfo.frequency.value = 3.2;
    wetAmLfo.start();
    g.wetAmLfo = wetAmLfo;

    const wetAmDepth = ctx.createGain();
    wetAmDepth.gain.value = 0.12;
    g.wetAmDepth = wetAmDepth;
    wetAmLfo.connect(wetAmDepth);
    wetAmDepth.connect(wetHissGain.gain);

    const wetPan = ctx.createStereoPanner();
    wetPan.pan.value = 0;
    g.wetPan = wetPan;

    g.noiseSrc!.connect(wetHissFilt);
    wetHissFilt.connect(wetHissFilt2);
    wetHissFilt2.connect(wetHissGain);
    wetHissGain.connect(wetPan);

    // afterburn noise
    const afterFilt = ctx.createBiquadFilter();
    afterFilt.type = 'highpass';
    afterFilt.frequency.value = 2000;

    const afterGain = ctx.createGain();
    afterGain.gain.value = 0;
    g.afterGain = afterGain;

    g.noiseSrc!.connect(afterFilt);
    afterFilt.connect(afterGain);

    // idle hum
    const humOsc = ctx.createOscillator();
    humOsc.type = 'sine';
    humOsc.frequency.value = 55;
    humOsc.start();
    g.humOsc = humOsc;

    const humGain = ctx.createGain();
    humGain.gain.value = 0.2;
    g.humGain = humGain;
    humOsc.connect(humGain);

    // mild delay smear
    const delay = ctx.createDelay(0.12);
    delay.delayTime.value = 0.025;
    g.delay = delay;

    const delayGain = ctx.createGain();
    delayGain.gain.value = 0.15;
    g.delayGain = delayGain;

    const sum = ctx.createGain();
    sum.gain.value = 1;
    bodyGain.connect(sum);
    carrierGain.connect(sum);
    howlGain.connect(sum);
    afterGain.connect(sum);
    humGain.connect(sum);
    wetPan.connect(sum);

    sum.connect(delay);
    delay.connect(delayGain);
    delayGain.connect(sum);

    const pan = ctx.createStereoPanner();
    pan.pan.value = 0;
    g.panL = pan;
    sum.connect(pan);
    pan.connect(g.master);
  }

  private teardownGraph(): void {
    const stopOsc = (o?: OscillatorNode | AudioBufferSourceNode) => {
      try {
        o?.stop();
        o?.disconnect();
      } catch {
        /* ignore */
      }
    };
    const g = this.g;
    stopOsc(g.noiseSrc);
    stopOsc(g.pinkSrc);
    stopOsc(g.fund);
    stopOsc(g.fund2);
    stopOsc(g.fund3);
    stopOsc(g.sub);
    stopOsc(g.pulseLfo);
    stopOsc(g.unevenLfo);
    stopOsc(g.whine1);
    stopOsc(g.whine2);
    stopOsc(g.whine3);
    stopOsc(g.carrier1);
    stopOsc(g.carrier2);
    stopOsc(g.carrier3);
    stopOsc(g.pulseMod);
    stopOsc(g.howlOsc);
    stopOsc(g.howlOsc2);
    stopOsc(g.humOsc);
    stopOsc(g.wetAmLfo);
    stopOsc(g.intakeWhineOsc);
    stopOsc(g.intakeWhineOsc2);
    stopOsc(g.intakeWhineOsc3);
    stopOsc(g.spoolFlutter);
    stopOsc(g.buzzSaw1);
    stopOsc(g.buzzSaw2);
    stopOsc(g.coreRoughLfo);
    stopOsc(g.airframeLfo);
    stopOsc(g.regenOsc);
    stopOsc(g.regenOsc2);
    stopOsc(g.dualWhineR);
    try {
      g.pulseNode?.disconnect();
      g.pulseGainOut?.disconnect();
    } catch {
      /* ignore */
    }
    try {
      g.master.disconnect();
      g.limiter.disconnect();
    } catch {
      /* ignore */
    }
  }

  /* ---------- param / driving apply ---------- */

  private setWorkletParam(name: string, value: number, tc: number): void {
    const node = this.g.pulseNode;
    if (!node) return;
    const param = node.parameters.get(name);
    if (!param) return;
    smooth(param, value, tc, this.context);
  }

  private applyAllParams(): void {
    const p = this.params;
    const g = this.g;
    const ctx = this.context;

    smooth(g.master.gain, clamp(Number(p.masterGain ?? 0.7)) * 0.9, 0.05, ctx);

    const ceiling = clamp(Number(p.limiterCeiling ?? 0.95));
    g.limiter.threshold.value = lerp(-18, -3, ceiling);

    if (this.patchMeta.kind === 'ice' && g.shaper) {
      // Keep soft — organic fallback must not grow digital bite with roughness
      g.shaper.curve = makeShaper(0.15 + Number(p.roughness ?? 0.35) * 0.28) as Float32Array<ArrayBuffer>;
    }

    if (g.iceMode === 'worklet') {
      this.setWorkletParam('pulseWidth', Number(p.pulseWidth ?? 0.35), 0.05);
      this.setWorkletParam('pulseJitter', Number(p.pulseJitter ?? 0.08), 0.05);
      this.setWorkletParam('roughness', Number(p.roughness ?? 0.4), 0.05);
      this.setWorkletParam('growl', Number(p.growl ?? 0.6), 0.05);
      this.setWorkletParam('exhaustLength', Number(p.exhaustLength ?? 0.45), 0.05);
      this.setWorkletParam('exhaustFeedback', Number(p.exhaustFeedback ?? 0.72), 0.05);
      this.setWorkletParam('mufflerMix', Number(p.muffling ?? 0.3), 0.05);
      this.setWorkletParam('intake', Number(p.intake ?? 0.45), 0.05);
      this.setWorkletParam('crackle', Number(p.crackle ?? 0.35), 0.05);
      this.setWorkletParam('cylinders', Number(p.cylinders ?? 8), 0.05);
      this.setWorkletParam('masterGain', clamp(Number(p.masterGain ?? 0.7)), 0.05);
    }
  }

  private applyDriving(immediate: boolean): void {
    const d = this.driving;
    const p = this.params;
    const g = this.g;
    const ctx = this.context;
    const tc = immediate ? 0.01 : 0.06;
    const kind = this.patchMeta.kind;

    const curve = Number(p.rpmCurve ?? 0.55);
    let rpmNorm = rpmCurve(d.speed, curve);
    if (d.speed < 0.04) {
      rpmNorm = Math.max(rpmNorm, d.throttle * 0.55);
    } else {
      rpmNorm = clamp(rpmNorm + d.throttle * 0.12);
    }

    const loadFeel = clamp(d.throttle * 0.7 + Math.abs(d.load ?? 0) * 0.3 + d.speed * 0.15);
    this.hud.loadFeel = loadFeel;
    this.hud.rpmNorm = rpmNorm;

    // Living drive: throttle/load hysteresis + micro-jitter (not 1:1 with slider)
    this.stepLivingDrive(immediate, tc, kind);

    if (g.panL && kind !== 'aerospace' && this.patchMeta.topology !== 'ev-dual-motor') {
      const width = Number(p.stereoWidth ?? 0.35);
      smooth(g.panL.pan, this.loadLag * width * 0.6, tc, ctx);
    }

    if (kind === 'ice') {
      this.applyIceDriving(rpmNorm, d, tc);
    } else if (kind === 'ev-whine') {
      this.applyEvDriving(rpmNorm, d, tc);
    } else if (kind === 'aerospace') {
      this.applyAerospaceDriving(rpmNorm, d, tc);
    } else {
      this.applyScifiDriving(rpmNorm, d, tc);
    }
    this.hud.driveMood = this.driveMood;
  }

  /** One-pole lag + random-walk jitter so character breathes. */
  private stepLivingDrive(immediate: boolean, tc: number, kind: Kind): void {
    const d = this.driving;
    const hTc =
      kind === 'aerospace' ? 0.2 : kind === 'ev-whine' ? 0.11 : 0.15;
    if (immediate || tc <= 0.015) {
      this.throttleLag = d.throttle;
      this.loadLag = d.load ?? 0;
      this.liveJit = { filt: 0, gain: 0, pitch: 0 };
    } else {
      const a = 1 - Math.exp(-Math.max(0.012, tc) / hTc);
      this.throttleLag += (d.throttle - this.throttleLag) * a;
      this.loadLag += ((d.load ?? 0) - this.loadLag) * a;
      const walk = (v: number, amt: number) => v * 0.94 + (Math.random() * 2 - 1) * amt;
      this.liveJit.filt = walk(this.liveJit.filt, 0.01);
      this.liveJit.gain = walk(this.liveJit.gain, 0.008);
      this.liveJit.pitch = walk(this.liveJit.pitch, 0.006);
    }
  }

  private applyIceDriving(rpmNorm: number, d: DrivingInput, tc: number): void {
    const p = this.params;
    const g = this.g;
    const ctx = this.context;

    const idle = Number(p.rpmIdle ?? 55);
    const red = Number(p.rpmRedline ?? 240);
    let fund = lerp(idle, red, rpmNorm);
    if (d.reverse) fund *= 0.92;
    this.hud.fundamentalHz = fund;

    const cyl = Number(p.cylinders ?? 8);
    // fund ≈ aggregate firing Hz ≈ N*rpm/120 → rpm = fund*120/N
    const rpm = clamp(fund * (120 / Math.max(4, cyl)), 200, 9000);

    const thr = this.throttleLag;
    const thrRaw = d.throttle;
    const loadL = this.loadLag;

    if (g.iceMode === 'worklet' && g.pulseNode) {
      // Hysteresis on throttle/load; worklet adds its own micro-jitter / valvetrain
      this.setWorkletParam('rpm', rpm * (1 + this.liveJit.pitch * 0.012), tc);
      this.setWorkletParam('throttle', thr, tc);
      this.setWorkletParam('load', loadL, tc);
      this.setWorkletParam('cylinders', cyl, tc);
      this.setWorkletParam('pulseWidth', Number(p.pulseWidth ?? 0.35), tc);
      this.setWorkletParam(
        'pulseJitter',
        Math.min(0.5, Number(p.pulseJitter ?? 0.08) + 0.02 + Math.abs(this.liveJit.pitch) * 0.08),
        tc,
      );
      this.setWorkletParam('roughness', Number(p.roughness ?? 0.4), tc);
      this.setWorkletParam('growl', Number(p.growl ?? 0.6) * (0.7 + Number(p.exhaust ?? 0.5) * 0.4), tc);
      this.setWorkletParam('exhaustLength', Number(p.exhaustLength ?? 0.45), tc);
      this.setWorkletParam(
        'exhaustFeedback',
        Number(p.exhaustFeedback ?? 0.72) * (0.85 + (1 - Number(p.muffling ?? 0.3)) * 0.15),
        tc,
      );
      this.setWorkletParam('mufflerMix', Number(p.muffling ?? 0.3), tc);
      this.setWorkletParam('intake', Number(p.intake ?? 0.45), tc);
      this.setWorkletParam('crackle', Number(p.crackle ?? 0.35), tc);
      const presenceBoost = 0.75 + Number(p.presence ?? 0.45) * 0.4;
      this.setWorkletParam('masterGain', clamp(Number(p.masterGain ?? 0.7) * presenceBoost), tc);
      if (d.speed < 0.04 && thrRaw < 0.12) this.driveMood = 'idle';
      else if (d.speed < 0.04) this.driveMood = 'lope';
      else if (thrRaw > 0.7) this.driveMood = 'pull';
      else this.driveMood = 'cruise';
      this.prevThrottle = thrRaw;
      return;
    }

    // Oscillator fallback: noise + soft pulse imitation (no triple-saw lead)
    const firing = (fund / 60) * (cyl / 2);

    if (g.fund2) smooth(g.fund2.frequency, fund * 0.5 * (1 + this.liveJit.pitch * 0.008), tc, ctx);
    if (g.sub) smooth(g.sub.frequency, fund * 0.5, tc, ctx);
    if (g.pulseLfo) smooth(g.pulseLfo.frequency, clamp(firing, 2, 48), tc, ctx);
    if (g.unevenLfo) smooth(g.unevenLfo.frequency, clamp(firing * 0.5, 1.0, 18), tc, ctx);

    const growl = Number(p.growl ?? 0.55);
    const presence = Number(p.presence ?? 0.45);
    const muffling = Number(p.muffling ?? 0.3);
    const intake = Number(p.intake ?? 0.4);
    const exhaust = Number(p.exhaust ?? 0.5);
    const ign = Number(p.ignitionNoise ?? 0.25);
    const rough = Number(p.roughness ?? 0.35);
    const parked = d.speed < 0.04;
    // thr/load already lagged above for worklet; reuse
    const fj = this.liveJit.filt;
    const gj = this.liveJit.gain;

    if (g.fund) {
      // Micro pitch wander
      smooth(g.fund.frequency, fund * (1 + this.liveJit.pitch * 0.01), tc, ctx);
    }

    if (g.fundGain) {
      const base =
        0.08 + growl * 0.1 + rpmNorm * 0.08 + thr * 0.12 + (parked ? 0.04 + thr * 0.08 : 0);
      smooth(g.fundGain.gain, base, tc, ctx);
    }
    if (g.pulseGain) {
      smooth(g.pulseGain.gain, 0.08 + rough * 0.22 + thr * 0.1 + (parked ? 0.06 : 0), tc, ctx);
    }
    if (g.unevenGain) {
      const lope = (cyl >= 8 ? 1 : 0.55) * (0.05 + rough * 0.14) * (1.25 - rpmNorm * 0.55);
      smooth(g.unevenGain.gain, lope + (parked ? 0.04 + thr * 0.05 : 0), tc, ctx);
    }
    if (g.subGain) {
      smooth(g.subGain.gain, growl * 0.28 * (0.4 + rpmNorm * 0.4 + thr * 0.12), tc, ctx);
    }
    if (g.presenceFilt) {
      smooth(
        g.presenceFilt.frequency,
        280 + presence * 500 + thr * 350 + rpmNorm * 200 + fj * 40,
        tc,
        ctx,
      );
    }
    if (g.muffler) {
      const open = lerp(700, 4200, 1 - muffling);
      smooth(g.muffler.frequency, open + thr * 1400 + rpmNorm * 500 + fj * 80, tc, ctx);
    }
    if (g.intakeGain) {
      const throttleFeel = parked ? Math.max(thr, thr * thr) : thr;
      smooth(g.intakeGain.gain, intake * throttleFeel * (0.5 + rpmNorm * 0.55), tc, ctx);
    }
    if (g.intakeFilt) {
      smooth(g.intakeFilt.frequency, 1000 + thr * 2800 + rpmNorm * 800, tc, ctx);
    }
    if (g.exhaustGain) {
      smooth(
        g.exhaustGain.gain,
        exhaust * (0.22 + rpmNorm * 0.28 + thr * 0.18 + (parked ? 0.1 + thr * 0.1 : 0)),
        tc,
        ctx,
      );
    }
    if (g.delay) {
      const len = Number(p.exhaustLength ?? 0.45);
      smooth(g.delay.delayTime, 0.008 + len * 0.035, tc, ctx);
    }
    if (g.delayGain) {
      const fb = Number(p.exhaustFeedback ?? 0.72) * (0.35 + (1 - muffling) * 0.25);
      smooth(g.delayGain.gain, clamp(fb, 0.15, 0.72), tc, ctx);
    }
    if (g.ignGain) {
      smooth(g.ignGain.gain, ign * (0.015 + thr * 0.1 + rpmNorm * 0.04 + rough * 0.02), tc, ctx);
    }
    if (g.mechGain) {
      smooth(
        g.mechGain.gain,
        (0.1 + rough * 0.14 + rpmNorm * 0.05 + thr * 0.04 + (parked ? 0.06 : 0)) * (1 + gj * 0.04),
        tc,
        ctx,
      );
    }
    if (g.mechFilt) {
      smooth(g.mechFilt.frequency, 520 + rpmNorm * 700 + thr * 350 + fj * 50, tc, ctx);
    }

    // Stochastic valvetrain tick (osc fallback) — sparse, irregular
    if (g.tickGain) {
      this.valveTickWait -= 1;
      if (this.valveTickWait <= 0) {
        const t0 = ctx.currentTime;
        const amp = 0.02 + rough * 0.05 + thr * 0.02;
        try {
          g.tickGain.gain.cancelScheduledValues(t0);
          g.tickGain.gain.setValueAtTime(amp, t0);
          g.tickGain.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.028 + Math.random() * 0.02);
        } catch {
          g.tickGain.gain.value = 0.001;
        }
        this.valveTickWait = Math.floor(8 + Math.random() * (28 + (1 - thr) * 40));
      }
    }

    if (parked && thrRaw < 0.12) this.driveMood = 'idle';
    else if (parked) this.driveMood = 'lope';
    else if (thrRaw > 0.7) this.driveMood = 'pull';
    else this.driveMood = 'cruise';
    this.prevThrottle = thrRaw;
  }

  private applyEvDriving(rpmNorm: number, d: DrivingInput, tc: number): void {
    const p = this.params;
    const g = this.g;
    const ctx = this.context;
    const topo = this.patchMeta.topology;

    const thr = this.throttleLag;
    const thrRaw = d.throttle;
    const base = Number(p.whinePitch ?? 180);
    const steps = Number(p.gearSteps ?? 0.35);

    // Inverter beat wander / detune drift
    this.evDetuneWander += (Math.random() * 2 - 1) * 0.35;
    this.evDetuneWander *= 0.97;
    this.liveJit.pitch = this.liveJit.pitch * 0.96 + (Math.random() * 2 - 1) * 0.008;

    const stepped = Math.floor(rpmNorm * (3 + steps * 5)) / (3 + steps * 5);
    let pitchMul = lerp(0.35, 1, Math.max(stepped, rpmNorm * 0.7));
    if (topo === 'ev-inverter-climb') {
      // Stronger ascending climb with speed/throttle
      pitchMul = lerp(0.28, 1.15, Math.max(stepped, rpmNorm * 0.55 + thr * 0.35));
    }
    let fund = base * pitchMul * (0.5 + rpmNorm * 0.5 + thr * 0.15);
    fund *= 1 + this.liveJit.pitch * 0.02;
    if (d.reverse) fund *= 0.85;
    this.hud.fundamentalHz = fund;

    const det = this.evDetuneWander;
    if (g.whine1) smooth(g.whine1.frequency, fund * (1 + det * 0.0008), tc, ctx);
    if (g.whine2) smooth(g.whine2.frequency, fund * 2 * (1 - det * 0.0005), tc, ctx);
    if (g.whine3) smooth(g.whine3.frequency, fund * 3.01, tc, ctx);
    if (g.whine1) g.whine1.detune.value = det * 0.4;
    if (g.whine2) g.whine2.detune.value = -det * 0.55;

    const presence = Number(p.presence ?? 0.55);
    if (g.whineGain) {
      const vol =
        (0.08 + rpmNorm * 0.22 + thr * 0.12) * (0.6 + presence * 0.6) +
        (d.speed < 0.03 ? thrRaw * 0.15 : 0);
      smooth(g.whineGain.gain, vol * (1 + this.liveJit.gain * 0.03), tc, ctx);
    }
    if (g.buzzGain) {
      smooth(
        g.buzzGain.gain,
        Number(p.inverterBuzz ?? 0.4) * (0.04 + rpmNorm * 0.1 + thr * 0.08),
        tc,
        ctx,
      );
    }
    if (g.buzzFilt) {
      smooth(g.buzzFilt.frequency, 2800 + rpmNorm * 3500 + this.liveJit.filt * 90, tc, ctx);
    }
    if (g.muffler) {
      const muff = Number(p.muffling ?? 0.2);
      smooth(g.muffler.frequency, lerp(2500, 9000, 1 - muff) + this.liveJit.filt * 60, tc, ctx);
    }

    // Gear mesh (climb pack emphasizes)
    const meshAmt = Number(p.gearMesh ?? (topo === 'ev-inverter-climb' ? 0.55 : 0.15));
    if (g.meshFilt) {
      smooth(g.meshFilt.frequency, 700 + rpmNorm * 1800 + thr * 600, tc, ctx);
    }
    if (g.meshGain) {
      const mesh =
        meshAmt *
        (0.02 + rpmNorm * 0.1 + thr * 0.08) *
        (topo === 'ev-inverter-climb' ? 1.35 : 0.55);
      smooth(g.meshGain.gain, mesh, tc, ctx);
    }

    // Regen howl: blooms on decel (speed high, throttle drop)
    const regenAmt = Number(p.regenHowl ?? (topo === 'ev-regen-howl' ? 0.78 : 0.15));
    const dThr = this.prevThrottle - thrRaw;
    const decel = d.speed > 0.18 && (dThr > 0.01 || thrRaw < 0.22);
    const regenGate =
      topo === 'ev-regen-howl'
        ? clamp(d.speed * 1.1) * (decel ? 1 : clamp(0.15 + (1 - thrRaw) * 0.35))
        : clamp(d.speed * 0.5) * (decel ? 0.55 : 0);
    if (g.regenOsc) smooth(g.regenOsc.frequency, 900 + d.speed * 2200 + (1 - thrRaw) * 800, tc, ctx);
    if (g.regenOsc2) smooth(g.regenOsc2.frequency, 1400 + d.speed * 2800, tc, ctx);
    if (g.regenFilt) {
      smooth(g.regenFilt.frequency, 1200 + d.speed * 2400 + this.liveJit.filt * 70, tc, ctx);
    }
    if (g.regenGain) {
      smooth(g.regenGain.gain, regenAmt * regenGate * (0.06 + d.speed * 0.14), tc, ctx);
    }

    // Dual motor L/R beat + mid roar
    const dual = Number(p.dualBeat ?? (topo === 'ev-dual-motor' ? 0.68 : 0));
    const roar = Number(p.motorRoar ?? (topo === 'ev-dual-motor' ? 0.72 : 0.12));
    if (g.dualWhineR) {
      smooth(g.dualWhineR.frequency, fund * (1.02 + dual * 0.04) * (1 - det * 0.001), tc, ctx);
      g.dualWhineR.detune.value = 8 + det * 0.8 + dual * 18;
    }
    if (g.dualWhineGainR) {
      smooth(g.dualWhineGainR.gain, dual * (0.08 + rpmNorm * 0.16 + thr * 0.1), tc, ctx);
    }
    if (g.motorFilt) {
      smooth(g.motorFilt.frequency, 500 + rpmNorm * 900 + thr * 400, tc, ctx);
    }
    if (g.motorGain) {
      smooth(
        g.motorGain.gain,
        roar * (0.06 + rpmNorm * 0.22 + thr * 0.12) * (topo === 'ev-dual-motor' ? 1 : 0.35),
        tc,
        ctx,
      );
    }
    if (g.panL && topo === 'ev-dual-motor') {
      const width = Number(p.stereoWidth ?? 0.7);
      smooth(g.panL.pan, -0.35 - width * 0.3 + this.loadLag * 0.1, tc, ctx);
    }
    if (g.panR && topo === 'ev-dual-motor') {
      const width = Number(p.stereoWidth ?? 0.7);
      smooth(g.panR.pan, 0.35 + width * 0.3 + this.loadLag * 0.1, tc, ctx);
    }

    if (topo === 'ev-regen-howl' && regenGate > 0.35) this.driveMood = 'regen';
    else if (d.speed < 0.04 && thrRaw < 0.08) this.driveMood = 'idle';
    else if (thrRaw > 0.55) this.driveMood = 'pull';
    else this.driveMood = 'cruise';

    this.prevThrottle = thrRaw;
  }


  private applyAerospaceDriving(rpmNorm: number, d: DrivingInput, tc: number): void {
    const p = this.params;
    const g = this.g;
    const ctx = this.context;

    const spoolBase = Number(p.spoolPitch ?? 95);
    const idleAmt = Number(p.idleSpool ?? 0.55);
    const roar = Number(p.jetRoar ?? 0.68);
    const intake = Number(p.intakeWhine ?? 0.5);
    const comp = Number(p.compressor ?? 0.65);
    const coreAmt = Number(p.turbine ?? 0.7);
    const after = Number(p.afterburn ?? 0.78);
    const nozzle = Number(p.jetScream ?? 0.45);
    const airframeAmt = Number(p.airframe ?? 0.55);
    const inertia = Number(p.spoolInertia ?? 0.62);

    const parked = d.speed < 0.04;
    const thr = this.throttleLag; // lagged throttle (hysteresis)
    const thrRaw = d.throttle;

    // Spool target + rate wander (living)
    this.spoolWander += (Math.random() * 2 - 1) * 0.012;
    this.spoolWander *= 0.96;
    const spoolTarget = clamp(
      rpmNorm * 0.62 + thr * 0.48 + (parked ? idleAmt * 0.22 + thr * 0.18 : 0) + this.spoolWander * 0.04,
    );
    const spoolTc = lerp(0.14, 0.52, inertia);
    if (tc <= 0.015) {
      this.spoolLag = spoolTarget;
    } else {
      const a = 1 - Math.exp(-Math.max(0.012, tc) / Math.max(0.08, spoolTc));
      this.spoolLag += (spoolTarget - this.spoolLag) * a;
    }
    const spool = clamp(this.spoolLag);

    // Soft AB onset hysteresis (lags open more than close a bit)
    const abWant = Math.max(0, thrRaw - 0.42) / 0.58;
    const abTc = abWant > this.abLag ? 0.22 : 0.12;
    if (tc <= 0.015) this.abLag = abWant * abWant;
    else {
      const aa = 1 - Math.exp(-Math.max(0.012, tc) / abTc);
      this.abLag += (abWant * abWant - this.abLag) * aa;
    }
    const abWet = clamp(this.abLag);

    let fund = spoolBase * lerp(0.55, 1.85, spool) * (1 + thr * 0.08);
    fund *= 1 + this.liveJit.pitch * 0.015;
    if (d.reverse) fund *= 0.9;
    this.hud.fundamentalHz = fund;

    const spoolSmooth = Math.max(tc, spoolTc * 0.55);
    const abSmooth = Math.min(tc, 0.08);
    const fj = this.liveJit.filt;
    const gj = this.liveJit.gain;

    if (g.compressorFilt) {
      smooth(g.compressorFilt.frequency, 900 + spool * 2400 + thr * 400 + fj * 80, spoolSmooth, ctx);
      g.compressorFilt.Q.value = 1.2 + spool * 0.8;
    }
    if (g.compressorGain) {
      const spoolNoise =
        comp *
        (0.08 + spool * 0.28 + (parked ? idleAmt * 0.06 : 0)) *
        (1 - thrRaw * thrRaw * 0.35) *
        (1 + gj * 0.04);
      smooth(g.compressorGain.gain, spoolNoise, spoolSmooth, ctx);
    }

    if (g.intakeWhineOsc) smooth(g.intakeWhineOsc.frequency, fund * 4.2, spoolSmooth, ctx);
    if (g.intakeWhineOsc2) smooth(g.intakeWhineOsc2.frequency, fund * 4.28, spoolSmooth, ctx);
    if (g.intakeWhineOsc3) smooth(g.intakeWhineOsc3.frequency, fund * 8.35, spoolSmooth, ctx);
    if (g.intakeWhineFilt) {
      smooth(g.intakeWhineFilt.frequency, 1400 + spool * 2200 + fj * 60, spoolSmooth, ctx);
      g.intakeWhineFilt.Q.value = 5 + intake * 4;
    }
    if (g.intakeWhineGain) {
      smooth(
        g.intakeWhineGain.gain,
        intake * (0.012 + spool * 0.055) * (1 - thrRaw * 0.25),
        spoolSmooth,
        ctx,
      );
    }
    if (g.spoolFlutter) {
      smooth(g.spoolFlutter.frequency, 1.6 + spool * 3.2 + Math.abs(this.spoolWander) * 2, spoolSmooth, ctx);
    }

    const buzz = Math.max(0, spool - 0.68) * 3.2;
    if (g.buzzSaw1) smooth(g.buzzSaw1.frequency, fund * 9.8, spoolSmooth, ctx);
    if (g.buzzSaw2) smooth(g.buzzSaw2.frequency, fund * 14.6, spoolSmooth, ctx);
    if (g.buzzSawGain) {
      smooth(g.buzzSawGain.gain, buzz * intake * 0.018, spoolSmooth, ctx);
    }

    if (g.coreFilt) {
      smooth(g.coreFilt.frequency, 700 + spool * 900 + thr * 500 + fj * 40, spoolSmooth, ctx);
    }
    if (g.coreFilt2) {
      smooth(g.coreFilt2.frequency, 220 + spool * 420 + thr * 180, spoolSmooth, ctx);
    }
    if (g.coreGain) {
      smooth(
        g.coreGain.gain,
        coreAmt * (0.12 + spool * 0.32 + thr * 0.14 + (parked ? idleAmt * 0.07 : 0)) * (1 + gj * 0.03),
        spoolSmooth,
        ctx,
      );
    }
    if (g.coreRoughLfo) {
      smooth(g.coreRoughLfo.frequency, 1.2 + spool * 2.8 + thr, abSmooth, ctx);
    }

    if (g.jetRoarFilt) {
      smooth(g.jetRoarFilt.frequency, 280 + rpmNorm * 500 + thr * 400, abSmooth, ctx);
    }
    if (g.jetRoarGain) {
      const exhaust =
        roar * (0.08 + rpmNorm * 0.16 + thr * thr * 0.28 + (parked ? idleAmt * 0.05 : 0));
      smooth(g.jetRoarGain.gain, exhaust, abSmooth, ctx);
    }

    if (g.afterGain) {
      smooth(g.afterGain.gain, after * abWet * 0.42, abSmooth, ctx);
    }
    if (g.afterFilt) {
      smooth(g.afterFilt.frequency, 600 + thrRaw * 1600 + fj * 50, abSmooth, ctx);
    }
    if (g.afterShaper) {
      g.afterShaper.curve = makeShaper(0.25 + abWet * 0.45) as Float32Array<ArrayBuffer>;
    }

    if (g.nozzleFilt) {
      smooth(g.nozzleFilt.frequency, 3800 + thrRaw * 3200, abSmooth, ctx);
    }
    if (g.nozzleGain) {
      smooth(g.nozzleGain.gain, nozzle * abWet * 0.07, abSmooth, ctx);
    }

    const loadAbs = Math.abs(this.loadLag);
    const buffet = clamp(loadAbs * 0.7 + (parked ? thr * 0.45 : rpmNorm * 0.2) + thr * 0.15);
    if (g.airframeFilt) {
      smooth(g.airframeFilt.frequency, 45 + buffet * 55, abSmooth, ctx);
    }
    if (g.airframeGain) {
      smooth(g.airframeGain.gain, airframeAmt * buffet * 0.16, abSmooth, ctx);
    }
    if (g.airframeLfo) {
      smooth(g.airframeLfo.frequency, 0.55 + buffet * 1.8, abSmooth, ctx);
    }

    if (g.panL) {
      const width = Number(p.stereoWidth ?? 0.6);
      smooth(g.panL.pan, -0.12 - width * 0.22 + this.loadLag * width * 0.18, tc, ctx);
    }
    if (g.panR) {
      const width = Number(p.stereoWidth ?? 0.6);
      smooth(g.panR.pan, 0.12 + width * 0.22 + this.loadLag * width * 0.18, tc, ctx);
    }

    if (abWet > 0.35) this.driveMood = 'ab';
    else if (spool < 0.35 && parked) this.driveMood = thrRaw > 0.15 ? 'spooling' : 'idle';
    else if (spool < 0.55) this.driveMood = 'spooling';
    else this.driveMood = 'cruise';
  }


  private applyScifiDriving(rpmNorm: number, d: DrivingInput, tc: number): void {
    const p = this.params;
    const g = this.g;
    const ctx = this.context;

    const core = Number(p.corePitch ?? 110);
    let fund = core * lerp(0.55, 2.2, rpmNorm) * (1 + d.throttle * 0.18);
    if (d.reverse) fund *= 0.9;
    this.hud.fundamentalHz = fund;

    if (g.carrier1) smooth(g.carrier1.frequency, fund, tc, ctx);
    if (g.carrier2) smooth(g.carrier2.frequency, fund * 0.997, tc, ctx);
    if (g.carrier3) smooth(g.carrier3.frequency, fund * 1.5, tc, ctx);

    const pulse = Number(p.pulseRate ?? 0.45);
    if (g.pulseMod) {
      smooth(g.pulseMod.frequency, lerp(2, 18, pulse) * (0.6 + rpmNorm), tc, ctx);
    }
    if (g.pulseDepth) {
      smooth(g.pulseDepth.gain, 0.08 + pulse * 0.22 + d.throttle * 0.06, tc, ctx);
    }

    const bite = Number(p.carrierBite ?? 0.4);
    if (g.carrierGain) {
      smooth(
        g.carrierGain.gain,
        (0.1 + rpmNorm * 0.18 + d.throttle * 0.12) * (0.5 + bite),
        tc,
        ctx,
      );
    }

    const body = Number(p.noiseBody ?? 0.5);
    const res = Number(p.resonance ?? 0.6);
    if (g.bodyGain) {
      smooth(g.bodyGain.gain, body * (0.18 + rpmNorm * 0.35 + d.throttle * 0.15), tc, ctx);
    }
    if (g.bodyFilt) {
      smooth(g.bodyFilt.frequency, 220 + rpmNorm * 900 + d.throttle * 400, tc, ctx);
      g.bodyFilt.Q.value = 1 + res * 6;
    }

    // Multi-formant scream
    const howl = Number(p.engineHowl ?? 0.55);
    const formantHowl = Number(p.formantHowl ?? howl);
    const spread = Number(p.formantSpread ?? 0.55);
    const howlAmt = formantHowl * (0.05 + d.throttle * 0.55 + rpmNorm * 0.35);

    if (g.howlGain) {
      smooth(g.howlGain.gain, howlAmt * 0.55, tc, ctx);
    }
    if (g.formantGain) {
      smooth(g.formantGain.gain, 0.7 + formantHowl * 0.5, tc, ctx);
    }

    const f1 = 320 + rpmNorm * 420 + d.throttle * 280 + spread * 180;
    const f2 = 720 + rpmNorm * 780 + d.throttle * 520 + spread * 320;
    const f3 = 1280 + rpmNorm * 1400 + d.throttle * 900 + spread * 500;

    if (g.howlOsc) {
      smooth(g.howlOsc.frequency, f1 * 0.45, tc, ctx);
    }
    if (g.howlOsc2) {
      smooth(g.howlOsc2.frequency, f1 * 0.68, tc, ctx);
    }
    if (g.howlFilt) {
      smooth(g.howlFilt.frequency, f1, tc, ctx);
      g.howlFilt.Q.value = 6 + res * 10;
    }
    if (g.howlFilt2) {
      smooth(g.howlFilt2.frequency, f2, tc, ctx);
      g.howlFilt2.Q.value = 4 + res * 8;
      g.howlFilt2.gain.value = 6 + formantHowl * 10;
    }
    if (g.howlFilt3) {
      smooth(g.howlFilt3.frequency, f3, tc, ctx);
      g.howlFilt3.Q.value = 5 + res * 9;
    }

    // Wet-road hiss
    const wet = Number(p.wetHiss ?? 0.5);
    const wetAmt = wet * (0.04 + rpmNorm * 0.22 + d.throttle * 0.35 + Math.abs(d.load ?? 0) * 0.12);
    if (g.wetHissGain) {
      // Base gain; AM LFO adds on top via AudioParam connection
      const baseGain = wetAmt * 0.45;
      try {
        g.wetHissGain.gain.cancelScheduledValues(ctx.currentTime);
        g.wetHissGain.gain.setTargetAtTime(baseGain, ctx.currentTime, tc);
      } catch {
        g.wetHissGain.gain.value = baseGain;
      }
    }
    if (g.wetAmDepth) {
      smooth(g.wetAmDepth.gain, wetAmt * 0.2, tc, ctx);
    }
    if (g.wetAmLfo) {
      smooth(g.wetAmLfo.frequency, 2.2 + rpmNorm * 4 + d.throttle * 3, tc, ctx);
    }
    if (g.wetHissFilt) {
      smooth(g.wetHissFilt.frequency, 1400 + rpmNorm * 1800 + d.throttle * 900, tc, ctx);
    }
    if (g.wetHissFilt2) {
      smooth(g.wetHissFilt2.frequency, 3200 + rpmNorm * 2800 + d.throttle * 1200, tc, ctx);
    }
    if (g.wetPan) {
      const width = Number(p.stereoWidth ?? 0.55);
      smooth(g.wetPan.pan, (d.load ?? 0) * width * 0.85, tc, ctx);
    }

    const after = Number(p.afterburn ?? 0.5);
    if (g.afterGain) {
      smooth(g.afterGain.gain, after * d.throttle * d.throttle * 0.22, tc, ctx);
    }

    const hum = Number(p.hum ?? 0.4);
    if (g.humGain) {
      const idleAmt = clamp(1 - rpmNorm * 2.2) * hum * 0.25;
      smooth(g.humGain.gain, idleAmt + (d.speed < 0.03 ? d.throttle * hum * 0.12 : 0), tc, ctx);
    }
    if (g.humOsc) {
      smooth(g.humOsc.frequency, core * 0.5, tc, ctx);
    }

    const doppler = Number(p.doppler ?? 0.35);
    if (g.delay) {
      smooth(g.delay.delayTime, 0.012 + doppler * 0.05 + Math.abs(d.load ?? 0) * 0.02, tc, ctx);
    }
    if (g.delayGain) {
      smooth(g.delayGain.gain, doppler * 0.28 + wet * 0.08, tc, ctx);
    }
  }
}

export function createEngineSynth(ctx: AudioContext, patch?: EnginePatch): EngineSynth {
  return new EngineSynthImpl(ctx, patch);
}
