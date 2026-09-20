import { defaultsForTopology, getBuiltin } from './builtins';
import type {
  DrivingInput,
  EngineId,
  EngineParams,
  EnginePatch,
  EngineSynth,
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
  private hud = { rpmNorm: 0, loadFeel: 0, fundamentalHz: 55 };
  private whiteBuf: AudioBuffer;
  private pinkBuf: AudioBuffer;
  private workletPromise: Promise<boolean> | null = null;
  private customGraph: SynthNodeDesc[] | undefined;

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
  }

  stop(): void {
    smooth(this.output.gain, 0, 0.12, this.context);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
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
    return { ...this.hud };
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
        this.applyAllParams();
        this.applyDriving(true);
        return true;
      } catch (err) {
        console.warn('[DriveSynth] pulse worklet unavailable, using oscillator ICE', err);
        this.g.iceMode = 'osc';
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

    const g: GraphHandles = { master, limiter, iceMode: 'osc' };

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
    } else {
      this.buildScifi(g);
    }

    return g;
  }

  private buildIce(g: GraphHandles): void {
    const ctx = this.context;

    const iceBus = ctx.createGain();
    iceBus.gain.value = 1;
    g.iceBus = iceBus;

    const fundGain = ctx.createGain();
    fundGain.gain.value = 0.35;
    g.fundGain = fundGain;

    const fund = ctx.createOscillator();
    fund.type = 'sawtooth';
    fund.frequency.value = 55;
    fund.start();
    g.fund = fund;

    const fund2 = ctx.createOscillator();
    fund2.type = 'square';
    fund2.frequency.value = 55;
    fund2.detune.value = 7;
    fund2.start();
    g.fund2 = fund2;

    const fund3 = ctx.createOscillator();
    fund3.type = 'sawtooth';
    fund3.frequency.value = 82.5;
    fund3.detune.value = -9;
    fund3.start();
    g.fund3 = fund3;

    const pulseLfo = ctx.createOscillator();
    pulseLfo.type = 'sine';
    pulseLfo.frequency.value = 8;
    pulseLfo.start();
    g.pulseLfo = pulseLfo;

    const pulseGain = ctx.createGain();
    pulseGain.gain.value = 0.35;
    g.pulseGain = pulseGain;
    pulseLfo.connect(pulseGain);
    pulseGain.connect(fundGain.gain);

    const unevenLfo = ctx.createOscillator();
    unevenLfo.type = 'sine';
    unevenLfo.frequency.value = 4;
    unevenLfo.start();
    g.unevenLfo = unevenLfo;

    const unevenGain = ctx.createGain();
    unevenGain.gain.value = 0.12;
    g.unevenGain = unevenGain;
    unevenLfo.connect(unevenGain);
    unevenGain.connect(fundGain.gain);

    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = 55;
    sub.start();
    g.sub = sub;

    const subGain = ctx.createGain();
    subGain.gain.value = 0.4;
    g.subGain = subGain;

    const shaper = ctx.createWaveShaper();
    shaper.curve = makeShaper(0.4) as Float32Array<ArrayBuffer>;
    shaper.oversample = '2x';
    g.shaper = shaper;

    const presenceFilt = ctx.createBiquadFilter();
    presenceFilt.type = 'peaking';
    presenceFilt.frequency.value = 1200;
    presenceFilt.Q.value = 1.2;
    presenceFilt.gain.value = 3;
    g.presenceFilt = presenceFilt;

    const muffler = ctx.createBiquadFilter();
    muffler.type = 'lowpass';
    muffler.frequency.value = 2800;
    muffler.Q.value = 0.7;
    g.muffler = muffler;

    fund.connect(shaper);
    fund2.connect(shaper);
    fund3.connect(shaper);
    shaper.connect(fundGain);
    fundGain.connect(presenceFilt);
    presenceFilt.connect(muffler);

    sub.connect(subGain);
    subGain.connect(muffler);

    const intakeFilt = ctx.createBiquadFilter();
    intakeFilt.type = 'bandpass';
    intakeFilt.frequency.value = 1800;
    intakeFilt.Q.value = 0.8;
    g.intakeFilt = intakeFilt;

    const intakeGain = ctx.createGain();
    intakeGain.gain.value = 0;
    g.intakeGain = intakeGain;

    g.noiseSrc!.connect(intakeFilt);
    intakeFilt.connect(intakeGain);
    intakeGain.connect(muffler);

    const exhaustFilt = ctx.createBiquadFilter();
    exhaustFilt.type = 'lowpass';
    exhaustFilt.frequency.value = 180;
    exhaustFilt.Q.value = 0.9;

    const exhaustGain = ctx.createGain();
    exhaustGain.gain.value = 0.2;
    g.exhaustGain = exhaustGain;

    g.pinkSrc!.connect(exhaustFilt);
    exhaustFilt.connect(exhaustGain);
    exhaustGain.connect(muffler);

    const ignFilt = ctx.createBiquadFilter();
    ignFilt.type = 'highpass';
    ignFilt.frequency.value = 2500;

    const ignGain = ctx.createGain();
    ignGain.gain.value = 0.05;
    g.ignGain = ignGain;

    g.noiseSrc!.connect(ignFilt);
    ignFilt.connect(ignGain);
    ignGain.connect(muffler);

    const mechFilt = ctx.createBiquadFilter();
    mechFilt.type = 'bandpass';
    mechFilt.frequency.value = 900;
    mechFilt.Q.value = 3.5;
    g.mechFilt = mechFilt;

    const mechGain = ctx.createGain();
    mechGain.gain.value = 0.04;
    g.mechGain = mechGain;

    g.noiseSrc!.connect(mechFilt);
    mechFilt.connect(mechGain);
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

    const pan = ctx.createStereoPanner();
    pan.pan.value = 0;
    g.panL = pan;
    muffler.connect(pan);
    pan.connect(g.master);
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
      g.shaper.curve = makeShaper(0.25 + Number(p.roughness ?? 0.35) * 0.7) as Float32Array<ArrayBuffer>;
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

    if (g.panL) {
      const width = Number(p.stereoWidth ?? 0.35);
      smooth(g.panL.pan, (d.load ?? 0) * width * 0.6, tc, ctx);
    }

    if (kind === 'ice') {
      this.applyIceDriving(rpmNorm, d, tc);
    } else if (kind === 'ev-whine') {
      this.applyEvDriving(rpmNorm, d, tc);
    } else {
      this.applyScifiDriving(rpmNorm, d, tc);
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

    if (g.iceMode === 'worklet' && g.pulseNode) {
      this.setWorkletParam('rpm', rpm, tc);
      this.setWorkletParam('throttle', d.throttle, tc);
      this.setWorkletParam('load', d.load ?? 0, tc);
      this.setWorkletParam('cylinders', cyl, tc);
      this.setWorkletParam('pulseWidth', Number(p.pulseWidth ?? 0.35), tc);
      this.setWorkletParam('pulseJitter', Number(p.pulseJitter ?? 0.08), tc);
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
      return;
    }

    // Oscillator fallback path
    const firing = (fund / 60) * (cyl / 2);

    if (g.fund) smooth(g.fund.frequency, fund, tc, ctx);
    if (g.fund2) smooth(g.fund2.frequency, fund * 2.005, tc, ctx);
    if (g.fund3) smooth(g.fund3.frequency, fund * 1.5, tc, ctx);
    if (g.sub) smooth(g.sub.frequency, fund * 0.5, tc, ctx);
    if (g.pulseLfo) smooth(g.pulseLfo.frequency, clamp(firing, 2, 48), tc, ctx);
    if (g.unevenLfo) smooth(g.unevenLfo.frequency, clamp(firing * 0.5, 1.2, 24), tc, ctx);

    const growl = Number(p.growl ?? 0.55);
    const presence = Number(p.presence ?? 0.45);
    const muffling = Number(p.muffling ?? 0.3);
    const intake = Number(p.intake ?? 0.4);
    const exhaust = Number(p.exhaust ?? 0.5);
    const ign = Number(p.ignitionNoise ?? 0.25);
    const rough = Number(p.roughness ?? 0.35);
    const parked = d.speed < 0.04;

    if (g.fundGain) {
      const base =
        0.16 + growl * 0.24 + rpmNorm * 0.14 + d.throttle * 0.18 + (parked ? d.throttle * 0.12 : 0);
      smooth(g.fundGain.gain, base, tc, ctx);
    }
    if (g.pulseGain) {
      smooth(g.pulseGain.gain, 0.1 + rough * 0.4 + d.throttle * 0.12, tc, ctx);
    }
    if (g.unevenGain) {
      const lope = (cyl >= 8 ? 1 : 0.55) * (0.06 + rough * 0.2) * (1.1 - rpmNorm * 0.5);
      smooth(g.unevenGain.gain, lope + (parked ? d.throttle * 0.08 : 0), tc, ctx);
    }
    if (g.subGain) {
      smooth(g.subGain.gain, growl * 0.5 * (0.35 + rpmNorm * 0.55 + d.throttle * 0.15), tc, ctx);
    }
    if (g.presenceFilt) {
      smooth(g.presenceFilt.frequency, 850 + presence * 1700 + d.throttle * 500, tc, ctx);
      g.presenceFilt.gain.value = presence * 9;
    }
    if (g.muffler) {
      const open = lerp(850, 5600, 1 - muffling);
      smooth(g.muffler.frequency, open + d.throttle * 900 + rpmNorm * 400, tc, ctx);
    }
    if (g.intakeGain) {
      const throttleFeel = parked ? Math.max(d.throttle, d.throttle * d.throttle) : d.throttle;
      smooth(g.intakeGain.gain, intake * throttleFeel * (0.4 + rpmNorm * 0.55), tc, ctx);
    }
    if (g.intakeFilt) {
      smooth(g.intakeFilt.frequency, 1100 + d.throttle * 2400 + rpmNorm * 900, tc, ctx);
    }
    if (g.exhaustGain) {
      smooth(
        g.exhaustGain.gain,
        exhaust * (0.14 + rpmNorm * 0.32 + d.throttle * 0.14 + (parked ? d.throttle * 0.08 : 0)),
        tc,
        ctx,
      );
    }
    if (g.ignGain) {
      smooth(g.ignGain.gain, ign * (0.02 + d.throttle * 0.14 + rpmNorm * 0.05), tc, ctx);
    }
    if (g.mechGain) {
      smooth(g.mechGain.gain, rough * (0.025 + rpmNorm * 0.06 + d.throttle * 0.05), tc, ctx);
    }
    if (g.mechFilt) {
      smooth(g.mechFilt.frequency, 700 + rpmNorm * 900 + d.throttle * 400, tc, ctx);
    }
  }

  private applyEvDriving(rpmNorm: number, d: DrivingInput, tc: number): void {
    const p = this.params;
    const g = this.g;
    const ctx = this.context;

    const base = Number(p.whinePitch ?? 180);
    const steps = Number(p.gearSteps ?? 0.35);
    const stepped = Math.floor(rpmNorm * (3 + steps * 5)) / (3 + steps * 5);
    const pitchMul = lerp(0.35, 1, Math.max(stepped, rpmNorm * 0.7));
    let fund = base * pitchMul * (0.5 + rpmNorm * 0.5 + d.throttle * 0.15);
    if (d.reverse) fund *= 0.85;
    this.hud.fundamentalHz = fund;

    if (g.whine1) smooth(g.whine1.frequency, fund, tc, ctx);
    if (g.whine2) smooth(g.whine2.frequency, fund * 2, tc, ctx);
    if (g.whine3) smooth(g.whine3.frequency, fund * 3.01, tc, ctx);

    const presence = Number(p.presence ?? 0.55);
    if (g.whineGain) {
      const vol =
        (0.08 + rpmNorm * 0.22 + d.throttle * 0.12) * (0.6 + presence * 0.6) +
        (d.speed < 0.03 ? d.throttle * 0.15 : 0);
      smooth(g.whineGain.gain, vol, tc, ctx);
    }
    if (g.buzzGain) {
      smooth(
        g.buzzGain.gain,
        Number(p.inverterBuzz ?? 0.4) * (0.04 + rpmNorm * 0.1 + d.throttle * 0.08),
        tc,
        ctx,
      );
    }
    if (g.buzzFilt) {
      smooth(g.buzzFilt.frequency, 2800 + rpmNorm * 3500, tc, ctx);
    }
    if (g.muffler) {
      const muff = Number(p.muffling ?? 0.2);
      smooth(g.muffler.frequency, lerp(2500, 9000, 1 - muff), tc, ctx);
    }
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
