// Browser Web Speech API — TTS output for JARVIS
let voice = null;

export function initVoice() {
  const voices = speechSynthesis.getVoices();
  voice =
    voices.find(v => v.name.includes('Samantha')) ||
    voices.find(v => v.name.includes('Daniel')) ||
    voices.find(v => v.name.includes('Google') && v.lang.startsWith('en')) ||
    voices.find(v => v.lang.startsWith('en')) ||
    voices[0] ||
    null;
}

if (typeof speechSynthesis !== 'undefined') {
  speechSynthesis.onvoiceschanged = initVoice;
  initVoice();
}

export function speak(text, opts = {}) {
  if (typeof speechSynthesis === 'undefined') return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  if (voice) utterance.voice = voice;
  utterance.rate   = opts.rate   ?? 1.0;
  utterance.pitch  = opts.pitch  ?? 1.0;
  utterance.volume = opts.volume ?? 1.0;
  speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
}

export function isSpeaking() {
  return speechSynthesis?.speaking ?? false;
}
