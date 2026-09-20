/**
 * Pulse-train ICE AudioWorkletProcessor
 * Combustion pulses on a 4-stroke firing schedule → Karplus–Strong exhaust waveguide.
 * Self-contained (no imports) for Tesla Chromium AudioWorklet constraints.
 */
class PulseEngineProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'rpm', defaultValue: 800, minValue: 200, maxValue: 9000, automationRate: 'k-rate' },
      { name: 'throttle', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'load', defaultValue: 0, minValue: -1, maxValue: 1, automationRate: 'k-rate' },
      { name: 'cylinders', defaultValue: 8, minValue: 4, maxValue: 12, automationRate: 'k-rate' },
      { name: 'pulseWidth', defaultValue: 0.35, minValue: 0.05, maxValue: 1, automationRate: 'k-rate' },
      { name: 'pulseJitter', defaultValue: 0.08, minValue: 0, maxValue: 0.5, automationRate: 'k-rate' },
      { name: 'roughness', defaultValue: 0.4, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'growl', defaultValue: 0.6, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'exhaustLength', defaultValue: 0.45, minValue: 0.05, maxValue: 1, automationRate: 'k-rate' },
      { name: 'exhaustFeedback', defaultValue: 0.72, minValue: 0.1, maxValue: 0.97, automationRate: 'k-rate' },
      { name: 'mufflerMix', defaultValue: 0.3, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'intake', defaultValue: 0.45, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'crackle', defaultValue: 0.35, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'masterGain', defaultValue: 0.7, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
    ];
  }

  constructor() {
    super();
    this._phase = 0; // crank phase in revolutions (0..1 per fire-cycle group)
    this._cylPhases = new Float64Array(12);
    this._env = new Float64Array(12);
    this._nextJitter = new Float64Array(12);
    for (let i = 0; i < 12; i++) {
      this._nextJitter[i] = (Math.random() * 2 - 1) * 0.02;
    }

    // Karplus–Strong delay line (~80ms max at 48k)
    const maxDelay = 4096;
    this._delay = new Float32Array(maxDelay);
    this._delayLen = maxDelay;
    this._wPos = 0;
    this._delaySamples = 400;

    // One-pole muffler LP
    this._muff = 0;

    // Intake / mechanical filters (simple one-poles / band approx)
    this._intakeLp = 0;
    this._intakeHp = 0;
    this._mechBp = 0;
    this._mechLp = 0;

    // Crackle state
    this._prevThrottle = 0;
    this._crackleEnv = 0;
    this._crackleHold = 0;

    // Pink-ish noise state
    this._b0 = 0;
    this._b1 = 0;
    this._b2 = 0;
    this._b3 = 0;
    this._b4 = 0;
    this._b5 = 0;
    this._b6 = 0;

    this._dc = 0;
    this.port.onmessage = (e) => {
      const d = e.data || {};
      if (d.type === 'reset') {
        this._phase = 0;
        this._delay.fill(0);
        this._muff = 0;
        this._crackleEnv = 0;
      }
    };
  }

  _pink() {
    const white = Math.random() * 2 - 1;
    this._b0 = 0.99886 * this._b0 + white * 0.0555179;
    this._b1 = 0.99332 * this._b1 + white * 0.0750759;
    this._b2 = 0.969 * this._b2 + white * 0.153852;
    this._b3 = 0.8665 * this._b3 + white * 0.3104856;
    this._b4 = 0.55 * this._b4 + white * 0.5329522;
    this._b5 = -0.7616 * this._b5 - white * 0.016898;
    const pink = (this._b0 + this._b1 + this._b2 + this._b3 + this._b4 + this._b5 + this._b6 + white * 0.5362) * 0.11;
    this._b6 = white * 0.115926;
    return pink;
  }

  _white() {
    return Math.random() * 2 - 1;
  }

  process(_inputs, outputs, parameters) {
    const out = outputs[0];
    if (!out || !out[0]) return true;
    const ch0 = out[0];
    const ch1 = out.length > 1 ? out[1] : null;
    const n = ch0.length;
    const sr = sampleRate;

    const rpmP = parameters.rpm;
    const thrP = parameters.throttle;
    const loadP = parameters.load;
    const cylP = parameters.cylinders;
    const pwP = parameters.pulseWidth;
    const jitP = parameters.pulseJitter;
    const roughP = parameters.roughness;
    const growlP = parameters.growl;
    const exLenP = parameters.exhaustLength;
    const exFbP = parameters.exhaustFeedback;
    const muffP = parameters.mufflerMix;
    const intakeP = parameters.intake;
    const crackP = parameters.crackle;
    const gainP = parameters.masterGain;

    const rpm0 = rpmP.length === 1 ? rpmP[0] : 0;
    const thr0 = thrP.length === 1 ? thrP[0] : 0;
    const load0 = loadP.length === 1 ? loadP[0] : 0;
    const cylN = Math.max(4, Math.min(12, Math.round(cylP.length === 1 ? cylP[0] : 8)));
    const pw0 = pwP.length === 1 ? pwP[0] : 0.35;
    const jit0 = jitP.length === 1 ? jitP[0] : 0.08;
    const rough0 = roughP.length === 1 ? roughP[0] : 0.4;
    const growl0 = growlP.length === 1 ? growlP[0] : 0.6;
    const exLen0 = exLenP.length === 1 ? exLenP[0] : 0.45;
    const exFb0 = exFbP.length === 1 ? exFbP[0] : 0.72;
    const muff0 = muffP.length === 1 ? muffP[0] : 0.3;
    const intake0 = intakeP.length === 1 ? intakeP[0] : 0.45;
    const crack0 = crackP.length === 1 ? crackP[0] : 0.35;
    const gain0 = gainP.length === 1 ? gainP[0] : 0.7;

    // Delay length from exhaustLength (pipe): ~2–28 ms
    const delayMs = 2 + exLen0 * 26;
    this._delaySamples = Math.max(8, Math.min(this._delayLen - 4, Math.floor((delayMs / 1000) * sr)));

    // Uneven lope offsets for V8-ish cross-plane (normalized within fire cycle)
    // Even-fire: equal 1/N. Cross-plane V8: pair spacing feels 90/150-ish.
    const isV8 = cylN === 8;

    for (let i = 0; i < n; i++) {
      const rpm = rpmP.length > 1 ? rpmP[i] : rpm0;
      const thr = thrP.length > 1 ? thrP[i] : thr0;
      const load = loadP.length > 1 ? loadP[i] : load0;
      const pw = pwP.length > 1 ? pwP[i] : pw0;
      const jit = jitP.length > 1 ? jitP[i] : jit0;
      const rough = roughP.length > 1 ? roughP[i] : rough0;
      const growl = growlP.length > 1 ? growlP[i] : growl0;
      const exFb = exFbP.length > 1 ? exFbP[i] : exFb0;
      const muffMix = muffP.length > 1 ? muffP[i] : muff0;
      const intakeAmt = intakeP.length > 1 ? intakeP[i] : intake0;
      const crackAmt = crackP.length > 1 ? crackP[i] : crack0;
      const master = gainP.length > 1 ? gainP[i] : gain0;

      const safeRpm = Math.max(200, Math.min(9000, rpm));
      // Crank revs per sample; one 720° cycle = 2 revs
      const revsPerSample = safeRpm / (60 * sr);
      this._phase += revsPerSample;

      // Aggregate firing: N fires per 2 revolutions → fire rate = N*rpm/120
      // Advance cylinder schedule in units of fire-slots
      // phase in [0,2) revolutions maps to fire index
      const cyclePhase = this._phase % 2; // 0..2 revs
      const firePos = (cyclePhase / 2) * cylN; // 0..cylN

      let pulse = 0;
      const pulseSamples = Math.max(4, Math.floor(pw * 0.004 * sr)); // ~0.2–4ms envelope
      const energy = 0.35 + thr * 0.55 + Math.max(0, load) * 0.12;

      for (let c = 0; c < cylN; c++) {
        let slot = c;
        if (isV8) {
          // Half-order lope: push odd cylinders slightly
          const lope = (c % 2 === 0 ? -0.12 : 0.18) * (0.5 + rough);
          slot = c + lope;
        }
        slot = ((slot % cylN) + cylN) % cylN;

        let dist = firePos - slot - this._nextJitter[c];
        if (dist < -cylN * 0.5) dist += cylN;
        if (dist > cylN * 0.5) dist -= cylN;

        // Distance in samples-ish via fire period
        const firePeriodSec = 120 / (cylN * safeRpm);
        const distSec = dist * firePeriodSec;
        const distSamp = distSec * sr;

        if (distSamp >= 0 && distSamp < pulseSamples) {
          const t = distSamp / pulseSamples;
          // Short attack, exponential decay
          const env = Math.exp(-t * (3.2 + (1 - thr) * 2)) * (1 - t * 0.15);
          const combustion = (0.7 + this._white() * 0.3 * (0.3 + jit)) * env * energy;
          pulse += combustion * (0.7 + growl * 0.5);

          // Resample jitter after a hit (when near start of pulse)
          if (distSamp < 1.5) {
            this._nextJitter[c] = (Math.random() * 2 - 1) * jit * 0.35;
          }
        }
      }

      // Inject pulse into waveguide
      const readPos = (this._wPos - this._delaySamples + this._delayLen) % this._delayLen;
      const delayed = this._delay[readPos | 0];
      // Averaging filter (KS)
      const readPos2 = (readPos - 1 + this._delayLen) % this._delayLen;
      const avg = 0.5 * (delayed + this._delay[readPos2 | 0]);
      const fb = Math.min(0.96, exFb * (0.88 + growl * 0.1));
      const excited = pulse * (0.9 + thr * 0.4) + avg * fb;
      this._delay[this._wPos] = excited;
      this._wPos = (this._wPos + 1) % this._delayLen;

      // Muffler lowpass mix
      const muffA = 0.12 + muffMix * 0.55;
      this._muff += muffA * (excited - this._muff);
      let exhaust = excited * (1 - muffMix * 0.75) + this._muff * (0.35 + muffMix * 0.65);

      // Intake: filtered noise * throttle
      const nw = this._white();
      this._intakeLp += 0.08 * (nw - this._intakeLp);
      this._intakeHp = nw - this._intakeLp;
      const intakeSig = this._intakeHp * intakeAmt * thr * (0.35 + thr * 0.65) * 0.22;

      // Mechanical bandpass * roughness
      const pn = this._pink();
      this._mechLp += 0.15 * (pn - this._mechLp);
      const hp = pn - this._mechLp;
      this._mechBp += 0.25 * (hp - this._mechBp);
      const mech = this._mechBp * rough * (0.04 + safeRpm / 9000 * 0.08 + thr * 0.05);

      // Crackle: throttle falling while rpm high
      const dThr = this._prevThrottle - thr;
      this._prevThrottle = thr;
      if (dThr > 0.002 && safeRpm > 2800 && thr < 0.45) {
        this._crackleHold = Math.min(1, this._crackleHold + dThr * 14);
      }
      this._crackleHold *= 0.995;
      this._crackleEnv = this._crackleHold;
      const crackBurst =
        this._crackleEnv > 0.02
          ? this._white() * this._crackleEnv * crackAmt * 0.35 * (safeRpm > 2800 ? 1 : 0.2)
          : 0;

      let sample = exhaust * (0.55 + growl * 0.35) + intakeSig + mech + crackBurst;

      // Soft saturate
      sample = Math.tanh(sample * (1.1 + growl * 0.5));

      // DC block
      const dcIn = sample;
      sample = dcIn - this._dc;
      this._dc += 0.0005 * (dcIn - this._dc);

      sample *= master * 0.85;

      // Light stereo from load
      const pan = Math.max(-1, Math.min(1, load * 0.35));
      const l = sample * (1 - Math.max(0, pan) * 0.35);
      const r = sample * (1 - Math.max(0, -pan) * 0.35);
      ch0[i] = l;
      if (ch1) ch1[i] = r;
    }

    return true;
  }
}

registerProcessor('pulse-engine-processor', PulseEngineProcessor);
