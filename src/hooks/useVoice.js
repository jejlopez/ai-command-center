// Voice interface — talk to JARVIS, hear responses.
// Uses Web Speech API for recognition + synthesis.

import { useState, useCallback, useRef } from "react";
import { jarvis } from "../lib/jarvis.js";

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export function useVoice() {
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("");
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);

  const speak = useCallback((text) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 0.95;
    utterance.volume = 0.9;

    // Try to find a good voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v =>
      v.name.includes("Daniel") || v.name.includes("Alex") ||
      v.name.includes("Samantha") || v.name.includes("Google UK English Male")
    );
    if (preferred) utterance.voice = preferred;

    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, []);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);

  const processCommand = useCallback(async (text) => {
    if (!text.trim()) return;
    setResponse("Thinking...");

    try {
      // Send to JARVIS /ask endpoint with voice context
      const result = await jarvis.ask({
        prompt: text,
        context: "Voice command from the user. Respond concisely — this will be spoken aloud. Keep under 3 sentences unless they asked for detail.",
      });

      const responseText = result.text ?? "I couldn't process that.";
      setResponse(responseText);
      speak(responseText);
    } catch (err) {
      const errMsg = "I'm having trouble connecting. Try again.";
      setResponse(errMsg);
      speak(errMsg);
      setError(err);
    }
  }, [speak]);

  const startListening = useCallback(() => {
    if (!SpeechRecognition) {
      setError("Speech recognition not supported in this browser");
      return;
    }

    stopSpeaking();
    setError(null);
    setTranscript("");

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => setListening(true);

    recognition.onresult = (event) => {
      let interim = "";
      let final = "";
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setTranscript(final || interim);
    };

    recognition.onend = () => {
      setListening(false);
      // Process the final transcript
      if (recognitionRef.current?._lastTranscript) {
        processCommand(recognitionRef.current._lastTranscript);
      }
    };

    recognition.onerror = (event) => {
      setListening(false);
      if (event.error !== "no-speech") {
        setError(`Speech error: ${event.error}`);
      }
    };

    // Track transcript for onend
    const originalOnResult = recognition.onresult;
    recognition.onresult = (event) => {
      originalOnResult(event);
      let final = "";
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        }
      }
      if (final) recognition._lastTranscript = final;
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [processCommand, stopSpeaking]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  return {
    listening,
    speaking,
    transcript,
    response,
    error,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    processCommand,
    supported: !!SpeechRecognition,
  };
}
