// Browser MediaRecorder — mic input, transcribed via jarvisd /voice/transcribe
let mediaRecorder = null;
let audioChunks = [];

export async function startListening() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
  audioChunks = [];

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) audioChunks.push(e.data);
  };

  mediaRecorder.start();
}

export async function stopListening() {
  return new Promise((resolve) => {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      resolve(null);
      return;
    }

    mediaRecorder.onstop = async () => {
      const blob = new Blob(audioChunks, { type: 'audio/webm' });
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');

      try {
        const res = await fetch('http://127.0.0.1:8787/voice/transcribe', {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();
        resolve(data.text ?? null);
      } catch {
        resolve(null);
      }

      // Release mic
      mediaRecorder.stream.getTracks().forEach(t => t.stop());
      mediaRecorder = null;
      audioChunks = [];
    };

    mediaRecorder.stop();
  });
}

export function isListening() {
  return mediaRecorder?.state === 'recording';
}
