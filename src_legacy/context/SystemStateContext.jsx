import React, { createContext, useContext, useState, useCallback } from 'react';

const SystemStateContext = createContext();

export function SystemStateProvider({ children }) {
  const [notificationsOpen, setNotificationsRaw] = useState(false);
  const [settingsOpen, setSettingsRaw] = useState(false);
  const [profileOpen, setProfileRaw] = useState(false);

  // Attention count — items needing human action in Mission Control
  // TODO: derive from live Supabase data (approvals + unseen completed)
  const [pendingCount, setPendingCount] = useState(0);

  const closeAll = useCallback(() => {
    setNotificationsRaw(false);
    setSettingsRaw(false);
    setProfileRaw(false);
  }, []);

  const setNotificationsOpen = useCallback((v) => { closeAll(); setNotificationsRaw(v); }, [closeAll]);
  const setSettingsOpen = useCallback((v) => { closeAll(); setSettingsRaw(v); }, [closeAll]);
  const setProfileOpen = useCallback((v) => { closeAll(); setProfileRaw(v); }, [closeAll]);

  return (
    <SystemStateContext.Provider value={{
      notificationsOpen, setNotificationsOpen,
      settingsOpen, setSettingsOpen,
      profileOpen, setProfileOpen,
      pendingCount, setPendingCount,
    }}>
      {children}
    </SystemStateContext.Provider>
  );
}

export const useSystemState = () => useContext(SystemStateContext);
