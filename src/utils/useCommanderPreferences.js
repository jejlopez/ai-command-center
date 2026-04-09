import { useEffect, useState } from 'react';

const STORAGE_KEYS = {
  humanHourlyRate: 'jarvis.humanHourlyRate',
  commandStyle: 'jarvis.commandStyle',
  alertPosture: 'jarvis.alertPosture',
  quietHoursEnabled: 'jarvis.quietHoursEnabled',
  quietHoursStart: 'jarvis.quietHoursStart',
  quietHoursEnd: 'jarvis.quietHoursEnd',
  notificationRoute: 'jarvis.notificationRoute',
  commanderPersona: 'jarvis.commanderPersona',
  trustedWriteMode: 'jarvis.trustedWriteMode',
  approvalDoctrine: 'jarvis.approvalDoctrine',
};

function readStoredNumber(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readStoredString(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  const raw = window.localStorage.getItem(key);
  return raw || fallback;
}

function readStoredBoolean(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  const raw = window.localStorage.getItem(key);
  if (raw == null) return fallback;
  return raw === 'true';
}

export function useCommanderPreferences() {
  const [humanHourlyRate, setHumanHourlyRateState] = useState(() =>
    readStoredNumber(STORAGE_KEYS.humanHourlyRate, 42)
  );
  const [commandStyle, setCommandStyleState] = useState(() =>
    readStoredString(STORAGE_KEYS.commandStyle, 'hybrid')
  );
  const [alertPosture, setAlertPostureState] = useState(() =>
    readStoredString(STORAGE_KEYS.alertPosture, 'balanced')
  );
  const [quietHoursEnabled, setQuietHoursEnabledState] = useState(() =>
    readStoredBoolean(STORAGE_KEYS.quietHoursEnabled, false)
  );
  const [quietHoursStart, setQuietHoursStartState] = useState(() =>
    readStoredString(STORAGE_KEYS.quietHoursStart, '22:00')
  );
  const [quietHoursEnd, setQuietHoursEndState] = useState(() =>
    readStoredString(STORAGE_KEYS.quietHoursEnd, '07:00')
  );
  const [notificationRoute, setNotificationRouteState] = useState(() =>
    readStoredString(STORAGE_KEYS.notificationRoute, 'command_center')
  );
  const [commanderPersona, setCommanderPersonaState] = useState(() =>
    readStoredString(STORAGE_KEYS.commanderPersona, 'founder')
  );
  const [trustedWriteMode, setTrustedWriteModeState] = useState(() =>
    readStoredString(STORAGE_KEYS.trustedWriteMode, 'review_first')
  );
  const [approvalDoctrine, setApprovalDoctrineState] = useState(() =>
    readStoredString(STORAGE_KEYS.approvalDoctrine, 'risk_weighted')
  );

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onStorage = (event) => {
      if (event.key === STORAGE_KEYS.humanHourlyRate) {
        setHumanHourlyRateState(readStoredNumber(STORAGE_KEYS.humanHourlyRate, 42));
      }
      if (event.key === STORAGE_KEYS.commandStyle) {
        setCommandStyleState(readStoredString(STORAGE_KEYS.commandStyle, 'hybrid'));
      }
      if (event.key === STORAGE_KEYS.alertPosture) {
        setAlertPostureState(readStoredString(STORAGE_KEYS.alertPosture, 'balanced'));
      }
      if (event.key === STORAGE_KEYS.quietHoursEnabled) {
        setQuietHoursEnabledState(readStoredBoolean(STORAGE_KEYS.quietHoursEnabled, false));
      }
      if (event.key === STORAGE_KEYS.quietHoursStart) {
        setQuietHoursStartState(readStoredString(STORAGE_KEYS.quietHoursStart, '22:00'));
      }
      if (event.key === STORAGE_KEYS.quietHoursEnd) {
        setQuietHoursEndState(readStoredString(STORAGE_KEYS.quietHoursEnd, '07:00'));
      }
      if (event.key === STORAGE_KEYS.notificationRoute) {
        setNotificationRouteState(readStoredString(STORAGE_KEYS.notificationRoute, 'command_center'));
      }
      if (event.key === STORAGE_KEYS.commanderPersona) {
        setCommanderPersonaState(readStoredString(STORAGE_KEYS.commanderPersona, 'founder'));
      }
      if (event.key === STORAGE_KEYS.trustedWriteMode) {
        setTrustedWriteModeState(readStoredString(STORAGE_KEYS.trustedWriteMode, 'review_first'));
      }
      if (event.key === STORAGE_KEYS.approvalDoctrine) {
        setApprovalDoctrineState(readStoredString(STORAGE_KEYS.approvalDoctrine, 'risk_weighted'));
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  function setHumanHourlyRate(value) {
    const numeric = Number(value);
    const safeValue = Number.isFinite(numeric) && numeric > 0 ? numeric : 42;
    setHumanHourlyRateState(safeValue);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEYS.humanHourlyRate, String(safeValue));
    }
  }

  function setCommandStyle(value) {
    const safeValue = value || 'hybrid';
    setCommandStyleState(safeValue);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEYS.commandStyle, safeValue);
    }
  }

  function setAlertPosture(value) {
    const safeValue = value || 'balanced';
    setAlertPostureState(safeValue);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEYS.alertPosture, safeValue);
    }
  }

  function setQuietHoursEnabled(value) {
    const safeValue = Boolean(value);
    setQuietHoursEnabledState(safeValue);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEYS.quietHoursEnabled, String(safeValue));
    }
  }

  function setQuietHoursStart(value) {
    const safeValue = value || '22:00';
    setQuietHoursStartState(safeValue);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEYS.quietHoursStart, safeValue);
    }
  }

  function setQuietHoursEnd(value) {
    const safeValue = value || '07:00';
    setQuietHoursEndState(safeValue);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEYS.quietHoursEnd, safeValue);
    }
  }

  function setNotificationRoute(value) {
    const safeValue = value || 'command_center';
    setNotificationRouteState(safeValue);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEYS.notificationRoute, safeValue);
    }
  }

  function setCommanderPersona(value) {
    const safeValue = value || 'founder';
    setCommanderPersonaState(safeValue);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEYS.commanderPersona, safeValue);
    }
  }

  function setTrustedWriteMode(value) {
    const safeValue = value || 'review_first';
    setTrustedWriteModeState(safeValue);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEYS.trustedWriteMode, safeValue);
    }
  }

  function setApprovalDoctrine(value) {
    const safeValue = value || 'risk_weighted';
    setApprovalDoctrineState(safeValue);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEYS.approvalDoctrine, safeValue);
    }
  }

  return {
    humanHourlyRate,
    setHumanHourlyRate,
    commandStyle,
    setCommandStyle,
    alertPosture,
    setAlertPosture,
    quietHoursEnabled,
    setQuietHoursEnabled,
    quietHoursStart,
    setQuietHoursStart,
    quietHoursEnd,
    setQuietHoursEnd,
    notificationRoute,
    setNotificationRoute,
    commanderPersona,
    setCommanderPersona,
    trustedWriteMode,
    setTrustedWriteMode,
    approvalDoctrine,
    setApprovalDoctrine,
  };
}
