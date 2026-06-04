let ctx = null;
let masterGain = null;
let started = false;
let muted = false;
let bassInterval = null;

function buildImpulseResponse(duration, decay) {
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * duration;
  const ir = ctx.createBuffer(2, length, sampleRate);
  for (let c = 0; c < 2; c++) {
    const data = ir.getChannelData(c);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return ir;
}

function makeOsc(freq, type, detuneC, gainVal) {
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.detune.value = detuneC;
  gain.gain.value = gainVal;
  osc.connect(gain);
  osc.start();
  return gain;
}

export const music = {
  start() {
    if (started) return;
    started = true;

    ctx = new AudioContext();
    masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0, ctx.currentTime);
    masterGain.gain.linearRampToValueAtTime(muted ? 0 : 0.1, ctx.currentTime + 5);

    // Reverb
    const convolver = ctx.createConvolver();
    convolver.buffer = buildImpulseResponse(3.5, 2);
    const dryGain  = ctx.createGain();
    const wetGain  = ctx.createGain();
    dryGain.gain.value = 0.6;
    wetGain.gain.value = 0.4;

    masterGain.connect(dryGain);
    masterGain.connect(convolver);
    convolver.connect(wetGain);
    dryGain.connect(ctx.destination);
    wetGain.connect(ctx.destination);

    // Organ drone: 4 oscillators
    const oscMix = ctx.createGain();
    oscMix.gain.value = 1;
    [
      makeOsc(55,  "sine",     0,    0.6),
      makeOsc(110, "sine",     1.5,  0.35),
      makeOsc(165, "triangle", -2,   0.18),
      makeOsc(220, "sine",     0.8,  0.12),
    ].forEach(g => g.connect(oscMix));

    // Filter with LFO
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 400;
    filter.Q.value = 1.2;
    oscMix.connect(filter);
    filter.connect(masterGain);

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.04;
    lfoGain.gain.value = 300;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    // Bass pulse every 2.5 seconds
    bassInterval = setInterval(() => {
      if (!ctx || muted) return;
      const bassOsc  = ctx.createOscillator();
      const bassGain = ctx.createGain();
      bassOsc.type = "sine";
      bassOsc.frequency.value = 27.5;
      bassGain.gain.setValueAtTime(0, ctx.currentTime);
      bassGain.gain.linearRampToValueAtTime(0.55, ctx.currentTime + 0.12);
      bassGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.4);
      bassOsc.connect(bassGain);
      bassGain.connect(masterGain);
      bassOsc.start();
      bassOsc.stop(ctx.currentTime + 1.5);
    }, 2500);
  },

  stop() {
    if (bassInterval) { clearInterval(bassInterval); bassInterval = null; }
    if (masterGain) masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1);
  },

  setVolume(v) {
    if (masterGain) masterGain.gain.setTargetAtTime(v, ctx.currentTime, 0.3);
  },

  toggle() {
    muted = !muted;
    this.setVolume(muted ? 0 : 0.1);
    localStorage.setItem("mc_music_muted", muted ? "1" : "0");
    return muted;
  },

  loadPref() {
    muted = localStorage.getItem("mc_music_muted") === "1";
    return muted;
  },
};
