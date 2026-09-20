/**
 * Render Engines Preview WAVs via OfflineAudioContext.
 * Approximate current pack topologies (~3.5s parked-rev → accel).
 * Run: node scripts/render-snippets.mjs
 * Permanent: refresh on every audio tip before ship.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OfflineAudioContext } from 'node-web-audio-api';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'public', 'snippets');
const SR = 44100;
const DUR = 3.5;

function envelope(t, attack, hold, release) {
  if (t < attack) return t / attack;
  if (t < hold) return 1;
  if (t < release) return 1 - (t - hold) / (release - hold);
  return 0;
}

/** Driving profile: idle 0–0.6s → rev 0.6–1.4 → accel 1.4–3.5 */
function driveAt(t) {
  let speed = 0;
  let throttle = 0.08;
  if (t < 0.55) {
    throttle = 0.05 + t * 0.05;
  } else if (t < 1.35) {
    throttle = 0.15 + (t - 0.55) * 0.85; // parked rev
    speed = 0.02;
  } else {
    const u = (t - 1.35) / (DUR - 1.35);
    speed = Math.min(1, u * 1.15);
    throttle = 0.55 + u * 0.4;
  }
  return { speed: Math.max(0, Math.min(1, speed)), throttle: Math.max(0, Math.min(1, throttle)) };
}

function smoothstep(x, e0, e1) {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

function fillNoise(buf, pink = false) {
  const ch = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < ch.length; i++) {
    const w = Math.random() * 2 - 1;
    if (!pink) {
      ch[i] = w;
    } else {
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      ch[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
  }
}

function makeNoise(ctx, seconds, pink) {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  fillNoise(buf, pink);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  return src;
}

function connectGain(ctx, node, gainVal = 1) {
  const g = ctx.createGain();
  g.gain.value = gainVal;
  node.connect(g);
  return g;
}

function scheduleParam(param, when, value) {
  param.setValueAtTime(value, when);
}

async function renderPack(id, buildFn) {
  const ctx = new OfflineAudioContext(2, Math.ceil(SR * DUR), SR);
  const master = ctx.createGain();
  master.gain.value = 0.85;
  master.connect(ctx.destination);
  buildFn(ctx, master);
  const rendered = await ctx.startRendering();
  return bufferToWav(rendered);
}

function bufferToWav(audioBuffer) {
  const numCh = audioBuffer.numberOfChannels;
  const len = audioBuffer.length;
  const sr = audioBuffer.sampleRate;
  const dataLen = len * numCh * 2;
  const buf = new ArrayBuffer(44 + dataLen);
  const view = new DataView(buf);
  const writeStr = (o, s) => {
    for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataLen, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numCh, true);
  view.setUint32(24, sr, true);
  view.setUint32(28, sr * numCh * 2, true);
  view.setUint16(32, numCh * 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataLen, true);
  const channels = [];
  for (let c = 0; c < numCh; c++) channels.push(audioBuffer.getChannelData(c));
  let off = 44;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < numCh; c++) {
      let s = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(off, (s * 0.9) * 0x7fff, true);
      off += 2;
    }
  }
  return Buffer.from(buf);
}

/** Automate gains/freqs along the drive profile at ~60Hz */
function automate(ctx, applyFrame) {
  const dt = 1 / 60;
  for (let t = 0; t <= DUR + 0.001; t += dt) {
    const d = driveAt(t);
    applyFrame(t, d);
  }
}

function buildIce(ctx, master, { cyl = 8, silk = false } = {}) {
  const pink = makeNoise(ctx, 2, true);
  const white = makeNoise(ctx, 2, false);
  const body = ctx.createBiquadFilter();
  body.type = 'lowpass';
  body.frequency.value = silk ? 420 : 280;
  const bodyG = ctx.createGain();
  bodyG.gain.value = 0;
  pink.connect(body);
  body.connect(bodyG);
  bodyG.connect(master);

  const pulse = ctx.createOscillator();
  pulse.type = silk ? 'triangle' : 'sawtooth';
  pulse.frequency.value = 55;
  pulse.start();
  const pulseG = ctx.createGain();
  pulseG.gain.value = 0;
  const pulseF = ctx.createBiquadFilter();
  pulseF.type = 'bandpass';
  pulseF.frequency.value = 180;
  pulseF.Q.value = silk ? 2 : 4;
  pulse.connect(pulseF);
  pulseF.connect(pulseG);
  pulseG.connect(master);

  const tick = ctx.createBiquadFilter();
  tick.type = 'bandpass';
  tick.frequency.value = 2200;
  tick.Q.value = 5;
  const tickG = ctx.createGain();
  tickG.gain.value = 0;
  white.connect(tick);
  tick.connect(tickG);
  tickG.connect(master);

  pink.start();
  white.start();

  automate(ctx, (t, d) => {
    const rpm = Math.max(d.speed * 0.7 + d.throttle * (d.speed < 0.05 ? 0.55 : 0.2), 0.05);
    const fund = 55 + rpm * (silk ? 160 : 200);
    scheduleParam(pulse.frequency, t, fund * (cyl / 8));
    scheduleParam(pulseG.gain, t, 0.08 + rpm * 0.28 + d.throttle * 0.12);
    scheduleParam(bodyG.gain, t, 0.12 + rpm * 0.35 + d.throttle * 0.1);
    scheduleParam(body.frequency, t, (silk ? 380 : 240) + rpm * 500 + d.throttle * 300);
    scheduleParam(tickG.gain, t, (silk ? 0.02 : 0.04) + d.throttle * 0.06);
  });
}

function buildEv(ctx, master, { climb = false, regen = false, dual = false } = {}) {
  const pink = makeNoise(ctx, 2, true);
  const white = makeNoise(ctx, 2, false);
  const whine = ctx.createOscillator();
  whine.type = 'sawtooth';
  whine.frequency.value = 180;
  whine.start();
  const whineG = ctx.createGain();
  whineG.gain.value = 0;
  const whineF = ctx.createBiquadFilter();
  whineF.type = 'bandpass';
  whineF.Q.value = climb ? 8 : 5;
  whine.connect(whineF);
  whineF.connect(whineG);
  whineG.connect(master);

  let whine2G = null;
  if (dual) {
    const w2 = ctx.createOscillator();
    w2.type = 'sawtooth';
    w2.frequency.value = 190;
    w2.detune.value = 12;
    w2.start();
    whine2G = ctx.createGain();
    whine2G.gain.value = 0;
    w2.connect(whine2G);
    whine2G.connect(master);
  }

  const buzzF = ctx.createBiquadFilter();
  buzzF.type = 'bandpass';
  buzzF.frequency.value = 3500;
  buzzF.Q.value = 4;
  const buzzG = ctx.createGain();
  buzzG.gain.value = 0;
  white.connect(buzzF);
  buzzF.connect(buzzG);
  buzzG.connect(master);

  const roarF = ctx.createBiquadFilter();
  roarF.type = 'lowpass';
  roarF.frequency.value = 600;
  const roarG = ctx.createGain();
  roarG.gain.value = 0;
  pink.connect(roarF);
  roarF.connect(roarG);
  roarG.connect(master);

  pink.start();
  white.start();

  automate(ctx, (t, d) => {
    const rpm = Math.max(d.speed, d.throttle * 0.5);
    const base = climb ? 220 : regen ? 160 : 180;
    const fund = base * (0.35 + rpm * 1.4);
    scheduleParam(whine.frequency, t, fund);
    scheduleParam(whineF.frequency, t, fund * 1.2);
    scheduleParam(whineG.gain, t, 0.06 + rpm * 0.22 + d.throttle * 0.1);
    if (whine2G) scheduleParam(whine2G.gain, t, 0.04 + rpm * 0.14);
    scheduleParam(buzzG.gain, t, 0.03 + rpm * 0.08);
    const regenAmt = regen && d.throttle < 0.25 && d.speed > 0.1 ? 0.2 : 0;
    scheduleParam(roarG.gain, t, 0.05 + rpm * 0.18 + regenAmt);
  });
}

function buildAero(ctx, master) {
  const pink = makeNoise(ctx, 2, true);
  const white = makeNoise(ctx, 2, false);
  const spool = ctx.createOscillator();
  spool.type = 'sawtooth';
  spool.frequency.value = 90;
  spool.start();
  const spoolG = ctx.createGain();
  spoolG.gain.value = 0;
  const spoolF = ctx.createBiquadFilter();
  spoolF.type = 'bandpass';
  spoolF.Q.value = 6;
  spool.connect(spoolF);
  spoolF.connect(spoolG);
  spoolG.connect(master);

  const roarF = ctx.createBiquadFilter();
  roarF.type = 'lowpass';
  roarF.frequency.value = 350;
  const roarG = ctx.createGain();
  roarG.gain.value = 0;
  pink.connect(roarF);
  roarF.connect(roarG);
  roarG.connect(master);

  const abF = ctx.createBiquadFilter();
  abF.type = 'highpass';
  abF.frequency.value = 2500;
  const abG = ctx.createGain();
  abG.gain.value = 0;
  white.connect(abF);
  abF.connect(abG);
  abG.connect(master);

  pink.start();
  white.start();

  automate(ctx, (t, d) => {
    const spoolAmt = Math.min(1, d.throttle * 0.7 + d.speed * 0.5);
    scheduleParam(spool.frequency, t, 70 + spoolAmt * 180);
    scheduleParam(spoolF.frequency, t, 800 + spoolAmt * 2000);
    scheduleParam(spoolG.gain, t, 0.04 + spoolAmt * 0.12);
    scheduleParam(roarG.gain, t, 0.08 + spoolAmt * 0.28 + d.throttle * d.throttle * 0.2);
    const ab = Math.max(0, d.throttle - 0.55) / 0.45;
    scheduleParam(abG.gain, t, ab * ab * 0.35);
  });
}

function buildScifi(ctx, master) {
  const pink = makeNoise(ctx, 2, true);
  const white = makeNoise(ctx, 2, false);

  // Carrier body
  const c1 = ctx.createOscillator();
  c1.type = 'sawtooth';
  c1.frequency.value = 110;
  c1.start();
  const cG = ctx.createGain();
  cG.gain.value = 0;
  c1.connect(cG);
  cG.connect(master);

  // Formant BP noise scream (lead)
  const f1 = ctx.createBiquadFilter();
  f1.type = 'bandpass';
  f1.Q.value = 7;
  const f2 = ctx.createBiquadFilter();
  f2.type = 'bandpass';
  f2.Q.value = 6;
  const f3 = ctx.createBiquadFilter();
  f3.type = 'bandpass';
  f3.Q.value = 5;
  const formantG = ctx.createGain();
  formantG.gain.value = 1;
  const howlG = ctx.createGain();
  howlG.gain.value = 0;
  pink.connect(f1);
  pink.connect(f2);
  white.connect(f3);
  f1.connect(formantG);
  f2.connect(formantG);
  f3.connect(formantG);
  formantG.connect(howlG);
  howlG.connect(master);

  const phrase = ctx.createOscillator();
  phrase.type = 'sine';
  phrase.frequency.value = 2.4;
  phrase.start();
  const phraseD = ctx.createGain();
  phraseD.gain.value = 0;
  phrase.connect(phraseD);
  phraseD.connect(howlG.gain);

  const wetF = ctx.createBiquadFilter();
  wetF.type = 'highpass';
  wetF.frequency.value = 2000;
  const wetG = ctx.createGain();
  wetG.gain.value = 0;
  white.connect(wetF);
  wetF.connect(wetG);
  wetG.connect(master);

  const afterF = ctx.createBiquadFilter();
  afterF.type = 'highpass';
  afterF.frequency.value = 2800;
  const afterG = ctx.createGain();
  afterG.gain.value = 0;
  white.connect(afterF);
  afterF.connect(afterG);
  afterG.connect(master);

  pink.start();
  white.start();

  automate(ctx, (t, d) => {
    const rpm = Math.max(d.speed * 0.65 + d.throttle * (d.speed < 0.05 ? 0.55 : 0.2), 0);
    const open = smoothstep(rpm, 0.15, 0.85);
    const fund = 110 * (0.55 + rpm * 1.65);
    scheduleParam(c1.frequency, t, fund);
    scheduleParam(cG.gain, t, 0.08 + rpm * 0.16 + d.throttle * 0.1);
    scheduleParam(f1.frequency, t, 320 + rpm * 420 + d.throttle * 280);
    scheduleParam(f2.frequency, t, 720 + rpm * 780 + d.throttle * 520);
    scheduleParam(f3.frequency, t, 1280 + rpm * 1400 + d.throttle * 900);
    const howlAmt = 0.72 * 0.62 * open; // formantHowl * engineHowl * open
    scheduleParam(howlG.gain, t, howlAmt * (0.75 + d.throttle * 0.35));
    scheduleParam(phraseD.gain, t, howlAmt * 0.25);
    scheduleParam(phrase.frequency, t, 1.6 + open * 3.8 + d.throttle * 2);
    scheduleParam(wetG.gain, t, 0.55 * open * (0.12 + rpm * 0.35 + d.throttle * 0.4) * 0.7);
    scheduleParam(afterG.gain, t, 0.52 * open * d.throttle * d.throttle * 0.55);
  });
}

const PACKS = [
  { id: 'v8-rumble', file: 'v8-rumble.wav', build: (c, m) => buildIce(c, m, { cyl: 8 }) },
  { id: 'i4-zip', file: 'i4-zip.wav', build: (c, m) => buildIce(c, m, { cyl: 4 }) },
  { id: 'i6-silk', file: 'i6-silk.wav', build: (c, m) => buildIce(c, m, { cyl: 6, silk: true }) },
  { id: 'ev-whine', file: 'ev-whine.wav', build: (c, m) => buildEv(c, m) },
  { id: 'ev-inverter-climb', file: 'ev-inverter-climb.wav', build: (c, m) => buildEv(c, m, { climb: true }) },
  { id: 'ev-regen-howl', file: 'ev-regen-howl.wav', build: (c, m) => buildEv(c, m, { regen: true }) },
  { id: 'ev-dual-motor', file: 'ev-dual-motor.wav', build: (c, m) => buildEv(c, m, { dual: true }) },
  { id: 'aerospace-f14', file: 'aerospace-f14.wav', build: (c, m) => buildAero(c, m) },
  { id: 'tie-fighter', file: 'ion-twin-tie-fighter.wav', build: (c, m) => buildScifi(c, m) },
];

mkdirSync(OUT, { recursive: true });

for (const pack of PACKS) {
  const wav = await renderPack(pack.id, pack.build);
  const dest = join(OUT, pack.file);
  writeFileSync(dest, wav);
  console.log('wrote', pack.file, `(${wav.length} bytes)`);
}
console.log('done', PACKS.length, 'snippets →', OUT);
