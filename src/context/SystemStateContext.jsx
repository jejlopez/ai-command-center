import React, { createContext, useContext, useState, useCallback } from 'react';
import { pendingReviews } from '../utils/mockData';

const SystemStateContext = createContext();

export function SystemStateProvider({ children }) {
  const [doctorModeOpen, setDoctorModeRaw] = useState(false);
  const [notificationsOpen, setNotificationsRaw] = useState(false);
  const [settingsOpen, setSettingsRaw] = useState(false);
  const [profileOpen, setProfileRaw] = useState(false);

  // Pending approval count — initialized from mockData, kept in sync by ReviewRoomView
  const [pendingCount, setPendingCount] = useState(pendingReviews.length);

  const closeAll = useCallback(() => {
    setDoctorModeRaw(false);
    setNotificationsRaw(false);
    setSettingsRaw(false);
    setProfileRaw(false);
  }, []);

  const setDoctorModeOpen = useCallback((v) => { closeAll(); setDoctorModeRaw(v); }, [closeAll]);
  const setNotificationsOpen = useCallback((v) => { closeAll(); setNotificationsRaw(v); }, [closeAll]);
  const setSettingsOpen = useCallback((v) => { closeAll(); setSettingsRaw(v); }, [closeAll]);
  const setProfileOpen = useCallback((v) => { closeAll(); setProfileRaw(v); }, [closeAll]);

  return (
    <SystemStateContext.Provider value={{
      doctorModeOpen, setDoctorModeOpen,
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
