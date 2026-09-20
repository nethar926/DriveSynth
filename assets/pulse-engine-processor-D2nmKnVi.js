/**
 * Pulse-train ICE AudioWorkletProcessor (organic v1 + PR cue sheet)
 * Buses: mechanical bed + soft combustion pulses + intake×throttle + exhaust waveguide.
 * V8 per-bank schedule 180°/90°/180°/270° + dual-collector L/R burble.
 * Anti-digital: soft asymmetric envelopes, noise/body dominate — no saw/square lead.
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
    this._phase = 0; // crank revolutions (mod 2 = 720° cycle)
    this._nextJitter = new Float64Array(12);
    this._ampJitter = new Float64Array(12);
    for (let i = 0; i < 12; i++) {
      this._nextJitter[i] = (Math.random() * 2 - 1) * 0.02;
      this._ampJitter[i] = 0.85 + Math.random() * 0.3;
    }

    // Cross-plane V8: 8 fires / 720°. Per-bank intervals 180/90/180/270.
    // L @ 0,180,270,450°  → intervals 180,90,180,270
    // R @ 90,360,540,630° → intervals 270,180,90,180 (rotated)
    // Overall still every 90° → 4th-order fundamental.
    this._v8Deg = new Float64Array([0, 90, 180, 270, 360, 450, 540, 630]);
    this._v8Bank = new Int8Array([0, 1, 0, 0, 1, 0, 1, 1]); // 0=L 1=R

    const maxDelay = 4096;
    this._delay = new Float32Array(maxDelay);
    this._delayLen = maxDelay;
    this._wPos = 0;
    this._delaySamples = 400;

    this._delay2 = new Float32Array(maxDelay);
    this._wPos2 = 0;
    this._delaySamples2 = 180;

    // Dual-collector cross burble (~0.8–2.5 ms)
    this._burble = new Float32Array(256);
    this._burbleLen = 256;
    this._burblePos = 0;
    this._burbleSamples = 48;

    this._muff = 0;
    this._bodyLp = 0;
    this._intakeLp = 0;
    this._intakeHp = 0;
    this._mechLp = 0;
    this._mechBp = 0;
    this._mechDeep = 0;
    this._tickLp = 0;
    this._lopePhase = Math.random() * Math.PI * 2;
    this._prevThrottle = 0;
    this._crackleHold = 0;
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
        this._delay2.fill(0);
        this._burble.fill(0);
        this._muff = 0;
        this._bodyLp = 0;
        this._crackleHold = 0;
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
    const pink =
      (this._b0 + this._b1 + this._b2 + this._b3 + this._b4 + this._b5 + this._b6 + white * 0.5362) *
      0.11;
    this._b6 = white * 0.115926;
    return pink;
  }

  _white() {
    return Math.random() * 2 - 1;
  }

  /** Soft asymmetric pressure pulse: gentle attack, longer blow-down decay. */
  _softEnv(t, thr) {
    const attack = 0.2;
    if (t < attack) {
      const a = t / attack;
      return a * a * (3 - 2 * a);
    }
    const u = (t - attack) / (1 - attack);
    const decay = 1.9 + (1 - thr) * 2.6;
    return Math.exp(-u * decay) * (1 - u * 0.1);
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

    const delayMs = 3 + exLen0 * 29;
    this._delaySamples = Math.max(10, Math.min(this._delayLen - 4, Math.floor((delayMs / 1000) * sr)));
    this._delaySamples2 = Math.max(8, Math.min(this._delayLen - 4, Math.floor(this._delaySamples * 0.42)));
    // Dual-collector burble delay scales mildly with roughness
    this._burbleSamples = Math.max(
      8,
      Math.min(this._burbleLen - 2, Math.floor((0.0009 + rough0 * 0.0016) * sr)),
    );

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
      const revsPerSample = safeRpm / (60 * sr);
      this._phase += revsPerSample;

      // Half-order mechanical AM lope (stronger at idle)
      this._lopePhase += revsPerSample * Math.PI * (isV8 ? 1.0 : 2.0);
      const lopeAm = 0.6 + 0.4 * Math.sin(this._lopePhase);
      const lopeAm2 = 0.75 + 0.25 * Math.sin(this._lopePhase * 0.5 + 0.7);

      // Crank degrees in 720° cycle
      const cycleRev = this._phase % 2;
      const crankDeg = cycleRev * 360; // 0..720

      const pulseSamples = Math.max(8, Math.floor((0.0024 + pw * 0.0058) * (1.18 - thr * 0.28) * sr));
      // Idle always has combustion energy
      const energy = 0.26 + thr * 0.58 + Math.max(0, load) * 0.14;

      let pulseL = 0;
      let pulseR = 0;
      const fireCount = isV8 ? 8 : cylN;

      for (let c = 0; c < fireCount; c++) {
        let fireDeg;
        let bank = 0;
        if (isV8) {
          fireDeg = this._v8Deg[c];
          bank = this._v8Bank[c];
        } else {
          // Even-fire I4/etc: equal spacing over 720°
          fireDeg = (c / cylN) * 720;
          bank = c % 2;
        }

        let distDeg = crankDeg - fireDeg - this._nextJitter[c] * 90; // jitter in degrees
        if (distDeg < -360) distDeg += 720;
        if (distDeg > 360) distDeg -= 720;
        // Only forward side of pulse (just after fire)
        if (distDeg < 0) distDeg += 720;
        if (distDeg > 360) continue;

        const degPerSample = (safeRpm / 60) * 360 / sr; // crank deg / sample
        const distSamp = distDeg / Math.max(1e-6, degPerSample);

        if (distSamp >= 0 && distSamp < pulseSamples) {
          const t = distSamp / pulseSamples;
          const env = this._softEnv(t, thr);
          const noiseBite = this._pink() * (0.16 + jit * 0.4);
          const amp = this._ampJitter[c];
          const combustion = (0.72 + noiseBite) * env * energy * amp;
          const p = combustion * (0.52 + growl * 0.48);
          if (bank === 0) pulseL += p;
          else pulseR += p;

          if (distSamp < 2) {
            // 0.5–3% timing noise + amplitude variance (PR cue)
            this._nextJitter[c] = (Math.random() * 2 - 1) * jit * (0.45 + rough * 0.4);
            this._ampJitter[c] = 0.78 + Math.random() * (0.25 + rough * 0.25);
          }
        }
      }

      const pulse = pulseL + pulseR;

      // --- Exhaust waveguide body (primary + secondary tap) ---
      const readPos = (this._wPos - this._delaySamples + this._delayLen) % this._delayLen;
      const delayed = this._delay[readPos | 0];
      const readPos2 = (readPos - 1 + this._delayLen) % this._delayLen;
      const avg = 0.5 * (delayed + this._delay[readPos2 | 0]);
      const fb = Math.min(0.955, exFb * (0.86 + growl * 0.12));
      const excited = pulse * (0.75 + thr * 0.45) + avg * fb * 0.97;
      this._delay[this._wPos] = excited * 0.995;
      this._wPos = (this._wPos + 1) % this._delayLen;

      const r2 = (this._wPos2 - this._delaySamples2 + this._delayLen) % this._delayLen;
      const d2 = this._delay2[r2 | 0];
      const excited2 = pulse * 0.35 + d2 * (fb * 0.78);
      this._delay2[this._wPos2] = excited2 * 0.992;
      this._wPos2 = (this._wPos2 + 1) % this._delayLen;

      const bodyRaw = excited * 0.72 + excited2 * 0.38;
      this._bodyLp += (0.18 + thr * 0.12) * (bodyRaw - this._bodyLp);

      const muffA = 0.1 + muffMix * 0.58;
      this._muff += muffA * (bodyRaw - this._muff);
      const exhaust =
        bodyRaw * (1 - muffMix * 0.7) + this._muff * (0.4 + muffMix * 0.6) + this._bodyLp * 0.25;

      // --- Mechanical bed ---
      const pn = this._pink();
      this._mechDeep += 0.04 * (pn - this._mechDeep);
      this._mechLp += 0.12 * (pn - this._mechLp);
      const hp = pn - this._mechLp;
      this._mechBp += 0.22 * (hp - this._mechBp);

      const idleBed =
        this._mechDeep * (0.14 + rough * 0.1) * lopeAm * (0.85 + (1 - thr) * 0.35);
      const midTick = this._mechBp * rough * (0.05 + safeRpm / 9000 * 0.1 + thr * 0.06) * lopeAm2;
      const tw = this._white();
      this._tickLp += 0.35 * (tw - this._tickLp);
      const tick =
        (tw - this._tickLp) *
        rough *
        rough *
        (0.012 + thr * 0.02) *
        (Math.random() < 0.02 + rough * 0.03 ? 1 : 0.15);
      const mech = idleBed + midTick + tick;

      // --- Intake × throttle ---
      const nw = this._white();
      this._intakeLp += 0.07 * (nw - this._intakeLp);
      this._intakeHp = nw - this._intakeLp;
      const thrFeel = thr * thr * 0.55 + thr * 0.45;
      const intakeSig =
        this._intakeHp * intakeAmt * thrFeel * (0.28 + thr * 0.7) * 0.32 +
        this._pink() * intakeAmt * thrFeel * 0.06;

      // Crackle only on throttle drop at high rpm
      const dThr = this._prevThrottle - thr;
      this._prevThrottle = thr;
      if (dThr > 0.002 && safeRpm > 2800 && thr < 0.45) {
        this._crackleHold = Math.min(1, this._crackleHold + dThr * 14);
      }
      this._crackleHold *= 0.995;
      const crackBurst =
        this._crackleHold > 0.02
          ? this._white() * this._crackleHold * crackAmt * 0.32 * (safeRpm > 2800 ? 1 : 0.2)
          : 0;

      const mono =
        exhaust * (0.62 + growl * 0.28) +
        mech +
        intakeSig +
        crackBurst +
        pulse * 0.1;

      // Dual-collector L/R burble: cross-feed opposite bank with short delay
      const bRead = (this._burblePos - this._burbleSamples + this._burbleLen) % this._burbleLen;
      const burbleIn = pulseR - pulseL;
      const burbleOut = this._burble[bRead | 0];
      this._burble[this._burblePos] = burbleIn * 0.85;
      this._burblePos = (this._burblePos + 1) % this._burbleLen;

      let sampleL = mono + pulseL * 0.08 + burbleOut * 0.12;
      let sampleR = mono + pulseR * 0.08 - burbleOut * 0.12;

      sampleL = Math.tanh(sampleL * (0.95 + growl * 0.35 + thr * 0.15));
      sampleR = Math.tanh(sampleR * (0.95 + growl * 0.35 + thr * 0.15));

      // DC block (shared approx on L; R follows)
      const dcIn = 0.5 * (sampleL + sampleR);
      const dcOut = dcIn - this._dc;
      this._dc += 0.0005 * (dcIn - this._dc);
      const dcCorr = dcOut - dcIn;
      sampleL = (sampleL + dcCorr) * master * 0.88;
      sampleR = (sampleR + dcCorr) * master * 0.88;

      const pan = Math.max(-1, Math.min(1, load * 0.35));
      ch0[i] = sampleL * (1 - Math.max(0, pan) * 0.35);
      if (ch1) ch1[i] = sampleR * (1 - Math.max(0, -pan) * 0.35);
    }

    return true;
  }
}

registerProcessor('pulse-engine-processor', PulseEngineProcessor);
