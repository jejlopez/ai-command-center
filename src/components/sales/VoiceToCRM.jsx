// VoiceToCRM — mic button that logs calls from voice memo.

import { useState, useRef } from "react";
import { Mic, MicOff, Loader2, Check } from "lucide-react";
import { supabase } from "../../lib/supabase.js";
import { jarvis } from "../../lib/jarvis.js";

export function VoiceToCRM({ leadId, dealId, contactId, onComplete }) {
  const [status, setStatus] = useState("idle"); // idle, recording, processing, done
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef(null);

  const startRecording = () => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      alert("Speech recognition not supported in this browser.");
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    let finalTranscript = "";

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + " ";
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setTranscript(finalTranscript + interim);
    };

    recognition.onerror = () => {
      setStatus("idle");
    };

    recognition.onend = () => {
      if (status === "recording") {
        setTranscript(finalTranscript.trim());
        processTranscript(finalTranscript.trim());
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setStatus("recording");
  };

  const stopRecording = () => {
    recognitionRef.current?.stop();
    setStatus("processing");
  };

  const processTranscript = async (text) => {
    if (!text || !supabase) { setStatus("idle"); return; }
    setStatus("processing");

    try {
      // 1. Create activity (call log)
      await supabase.from("activities").insert({
        lead_id: leadId || null,
        deal_id: dealId || null,
        contact_id: contactId || null,
        type: "call",
        subject: "Voice memo — call log",
        body: text,
        source: "voice",
        occurred_at: new Date().toISOString(),
      });

      // 2. Try to extract structured data via Jarvis skill
      try {
        await jarvis.runSkill("call_summary", {
          leadId, dealId, transcript: text,
        });
      } catch {
        // Skill not available yet — the raw transcript is still logged
      }

      setStatus("done");
      onComplete?.();
    } catch (e) {
      console.error("Voice-to-CRM failed:", e);
      setStatus("idle");
    }
  };

  if (status === "done") {
    return (
      <button className="flex items-center gap-1 text-[9px] text-jarvis-success px-2 py-1 rounded-md bg-jarvis-success/10" title="Call logged">
        <Check size={11} /> Logged
      </button>
    );
  }

  if (status === "processing") {
    return (
      <button className="flex items-center gap-1 text-[9px] text-jarvis-purple px-2 py-1 rounded-md bg-jarvis-purple/10" disabled>
        <Loader2 size={11} className="animate-spin" /> Processing…
      </button>
    );
  }

  if (status === "recording") {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={stopRecording}
          className="flex items-center gap-1 text-[9px] text-jarvis-danger px-2 py-1 rounded-md bg-jarvis-danger/15 animate-pulse"
          title="Stop recording"
        >
          <MicOff size={11} /> Stop
        </button>
        {transcript && (
          <div className="text-[9px] text-jarvis-muted max-w-[200px] truncate">{transcript}</div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={startRecording}
      className="flex items-center gap-1 text-[9px] text-jarvis-purple px-2 py-1 rounded-md bg-jarvis-purple/10 hover:bg-jarvis-purple/20 transition"
      title="Log call via voice"
    >
      <Mic size={11} /> Log Call
    </button>
  );
}
