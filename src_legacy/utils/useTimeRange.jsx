import React, { createContext, useContext, useState, useEffect } from 'react';

const TimeRangeContext = createContext();

export function TimeRangeProvider({ children }) {
  const [range, setRange] = useState('1h');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const r = params.get('range');
    if (r && ['15m', '1h', '6h', '24h', '7d'].includes(r)) {
      setRange(r);
    }
  }, []);

  const handleSetRange = (newRange) => {
    setRange(newRange);
    const url = new URL(window.location);
    url.searchParams.set('range', newRange);
    window.history.pushState({}, '', url);
  };

  return (
    <TimeRangeContext.Provider value={{ range, setRange: handleSetRange }}>
      {children}
    </TimeRangeContext.Provider>
  );
}

export function useTimeRange() {
  return useContext(TimeRangeContext);
}
