// JARVIS Audio Engine — Web Audio API synth for login screen.
// No audio files needed — everything is generated in real-time.

let ctx = null;

function getCtx() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return ctx;
}

// Low-frequency ambient hum — sustained drone that rises with activity
let humOsc = null;
let humGain = null;

export function startHum() {
  try {
    const ac = getCtx();
    if (humOsc) return;

    humOsc = ac.createOscillator();
    humGain = ac.createGain();
    const filter = ac.createBiquadFilter();

    humOsc.type = "sine";
    humOsc.frequency.value = 55; // A1 — deep hum
    humGain.gain.value = 0;
    filter.type = "lowpass";
    filter.frequency.value = 200;

    humOsc.connect(filter);
    filter.connect(humGain);
    humGain.connect(ac.destination);
    humOsc.start();

    // Fade in
    humGain.gain.linearRampToValueAtTime(0.03, ac.currentTime + 2);
  } catch { /* silent */ }
}

export function setHumIntensity(level) {
  // level 0-1: 0 = idle, 1 = max activity
  if (!humGain || !humOsc) return;
  try {
    const ac = getCtx();
    humGain.gain.linearRampToValueAtTime(0.02 + level * 0.04, ac.currentTime + 0.1);
    humOsc.frequency.linearRampToValueAtTime(55 + level * 40, ac.currentTime + 0.1);
  } catch { /* silent */ }
}

export function stopHum() {
  try {
    if (humGain) humGain.gain.linearRampToValueAtTime(0, getCtx().currentTime + 0.5);
    setTimeout(() => {
      try { humOsc?.stop(); } catch {}
      humOsc = null;
      humGain = null;
    }, 600);
  } catch { /* silent */ }
}

// Keystroke tick — tiny blip per character typed
export function playKeystroke() {
  try {
    const ac = getCtx();
    const osc = ac.createOscillator();
    const gain = ac.createGain();

    osc.type = "sine";
    osc.frequency.value = 800 + Math.random() * 400;
    gain.gain.value = 0.015;
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.06);

    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + 0.06);
  } catch { /* silent */ }
}

// Auth failure — dissonant chord
export function playFailure() {
  try {
    const ac = getCtx();
    [220, 233, 277].forEach((freq, i) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "sawtooth";
      osc.frequency.value = freq;
      gain.gain.value = 0.04;
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.8);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(ac.currentTime + i * 0.02);
      osc.stop(ac.currentTime + 0.8);
    });
  } catch { /* silent */ }
}

// Auth success — ascending power-up chord (Iron Man suit)
export function playUnlock() {
  try {
    const ac = getCtx();
    const notes = [261, 329, 392, 523, 659]; // C4 E4 G4 C5 E5

    notes.forEach((freq, i) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.value = 0;
      gain.gain.linearRampToValueAtTime(0.06, ac.currentTime + i * 0.12 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + i * 0.12 + 0.6);

      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(ac.currentTime + i * 0.12);
      osc.stop(ac.currentTime + i * 0.12 + 0.7);
    });

    // Final shimmer
    setTimeout(() => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "sine";
      osc.frequency.value = 1046;
      gain.gain.value = 0.03;
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 1.2);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start();
      osc.stop(ac.currentTime + 1.2);
    }, 500);
  } catch { /* silent */ }
}
