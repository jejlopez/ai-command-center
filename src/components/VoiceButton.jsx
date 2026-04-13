// Voice button — hold to talk to JARVIS, release to process.
// Shows listening state, transcript, and JARVIS response.

import { useState } from "react";
import { Mic, MicOff, Volume2, VolumeX, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useVoice } from "../hooks/useVoice.js";

export function VoiceButton() {
  const {
    listening, speaking, transcript, response, error,
    startListening, stopListening, stopSpeaking,
    supported,
  } = useVoice();
  const [showPanel, setShowPanel] = useState(false);

  if (!supported) return null;

  const isActive = listening || speaking || showPanel;

  return (
    <div className="relative">
      <button
        onClick={() => {
          if (listening) {
            stopListening();
          } else if (speaking) {
            stopSpeaking();
          } else {
            startListening();
            setShowPanel(true);
          }
        }}
        className={[
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all",
          listening
            ? "bg-jarvis-danger/15 text-jarvis-danger border border-jarvis-danger/20"
            : speaking
            ? "bg-jarvis-primary/15 text-jarvis-primary border border-jarvis-primary/20"
            : "bg-jarvis-surface border border-jarvis-border text-jarvis-muted hover:text-jarvis-ink hover:border-jarvis-border-hover",
        ].join(" ")}
      >
        {listening ? (
          <>
            <Mic size={13} className="animate-pulse" />
            Listening...
          </>
        ) : speaking ? (
          <>
            <Volume2 size={13} />
            Speaking...
          </>
        ) : (
          <>
            <Mic size={13} />
            Talk
          </>
        )}
      </button>

      <AnimatePresence>
        {showPanel && (transcript || response) && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            className="absolute right-0 top-full mt-2 w-80 surface p-4 z-50 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="label">JARVIS Voice</span>
              <button
                onClick={() => { stopSpeaking(); setShowPanel(false); }}
                className="text-jarvis-muted hover:text-jarvis-ink"
              >
                <X size={12} />
              </button>
            </div>

            {transcript && (
              <div>
                <div className="text-[9px] text-jarvis-muted uppercase tracking-wider mb-1">You said</div>
                <div className="text-[12px] text-jarvis-ink">{transcript}</div>
              </div>
            )}

            {response && (
              <div>
                <div className="text-[9px] text-jarvis-primary uppercase tracking-wider mb-1">JARVIS</div>
                <div className="text-[12px] text-jarvis-body leading-relaxed">{response}</div>
              </div>
            )}

            {error && (
              <div className="text-[10px] text-jarvis-danger">{error}</div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={startListening}
                disabled={listening}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-medium bg-jarvis-primary/10 text-jarvis-primary border border-jarvis-primary/15 disabled:opacity-30"
              >
                <Mic size={11} /> Ask again
              </button>
              {speaking && (
                <button
                  onClick={stopSpeaking}
                  className="px-3 py-2 rounded-lg text-[10px] bg-jarvis-surface border border-jarvis-border text-jarvis-muted"
                >
                  <VolumeX size={11} />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
