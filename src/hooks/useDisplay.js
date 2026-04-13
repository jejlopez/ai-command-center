import { useState, useCallback } from "react";

export function useDisplay() {
  const [displayState, setDisplayState] = useState({ widgets: [] });
  const [history, setHistory] = useState([]);

  const pushDisplay = useCallback((newState) => {
    setHistory(prev => [...prev, displayState]);
    setDisplayState(newState);
  }, [displayState]);

  const goBack = useCallback(() => {
    setHistory(prev => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setDisplayState(last);
      return prev.slice(0, -1);
    });
  }, []);

  const clearDisplay = useCallback(() => {
    setDisplayState({ widgets: [] });
    setHistory([]);
  }, []);

  return { displayState, pushDisplay, goBack, clearDisplay, history };
}
