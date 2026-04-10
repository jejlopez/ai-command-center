import React, { createContext, useContext } from 'react';
import { useCommanderPreferences } from '../utils/useCommanderPreferences';

const PreferenceContext = createContext(null);

export function PreferenceProvider({ children }) {
  const preferences = useCommanderPreferences();
  
  return (
    <PreferenceContext.Provider value={preferences}>
      {children}
    </PreferenceContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferenceContext);
  if (!context) {
    throw new Error('usePreferences must be used within a PreferenceProvider');
  }
  return context;
}
