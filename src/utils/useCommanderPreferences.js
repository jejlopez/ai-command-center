import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

const DEFAULTS = {
  humanHourlyRate: 42,
  commandStyle: 'hybrid',
  alertPosture: 'balanced',
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  notificationRoute: 'command_center',
  slackWebhookUrl: '',
  notificationEmail: '',
  themePreference: 'obsidian',
  commanderPersona: 'founder',
  trustedWriteMode: 'review_first',
  approvalDoctrine: 'risk_weighted',
};

function mapRowToPreferences(row) {
  return {
    humanHourlyRate: Number(row?.human_hourly_rate ?? DEFAULTS.humanHourlyRate),
    commandStyle: row?.command_style || DEFAULTS.commandStyle,
    alertPosture: row?.alert_posture || DEFAULTS.alertPosture,
    quietHoursEnabled: row?.quiet_hours_enabled ?? DEFAULTS.quietHoursEnabled,
    quietHoursStart: row?.quiet_hours_start || DEFAULTS.quietHoursStart,
    quietHoursEnd: row?.quiet_hours_end || DEFAULTS.quietHoursEnd,
    notificationRoute: row?.notification_route || DEFAULTS.notificationRoute,
    slackWebhookUrl: row?.slack_webhook_url || DEFAULTS.slackWebhookUrl,
    notificationEmail: row?.notification_email || DEFAULTS.notificationEmail,
    themePreference: row?.theme_preference || DEFAULTS.themePreference,
    commanderPersona: row?.commander_persona || DEFAULTS.commanderPersona,
    trustedWriteMode: row?.trusted_write_mode || DEFAULTS.trustedWriteMode,
    approvalDoctrine: row?.approval_doctrine || DEFAULTS.approvalDoctrine,
  };
}

function mapPreferencesToRow(userId, prefs) {
  return {
    user_id: userId,
    human_hourly_rate: prefs.humanHourlyRate,
    command_style: prefs.commandStyle,
    alert_posture: prefs.alertPosture,
    quiet_hours_enabled: prefs.quietHoursEnabled,
    quiet_hours_start: prefs.quietHoursStart,
    quiet_hours_end: prefs.quietHoursEnd,
    notification_route: prefs.notificationRoute,
    slack_webhook_url: prefs.slackWebhookUrl,
    notification_email: prefs.notificationEmail,
    theme_preference: prefs.themePreference,
    commander_persona: prefs.commanderPersona,
    trusted_write_mode: prefs.trustedWriteMode,
    approval_doctrine: prefs.approvalDoctrine,
  };
}

export function useCommanderPreferences() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const hydratedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function loadPreferences() {
      if (!user) {
        hydratedRef.current = false;
        setPreferences(DEFAULTS);
        setLoading(false);
        return;
      }

      setLoading(true);

      const { data, error } = await supabase
        .from('user_settings')
        .select(`
          human_hourly_rate,
          command_style,
          alert_posture,
          quiet_hours_enabled,
          quiet_hours_start,
          quiet_hours_end,
          notification_route,
          slack_webhook_url,
          notification_email,
          theme_preference,
          commander_persona,
          trusted_write_mode,
          approval_doctrine
        `)
        .eq('user_id', user.id)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error('[useCommanderPreferences] load:', error.message);
        setPreferences(DEFAULTS);
      } else {
        setPreferences({ ...DEFAULTS, ...mapRowToPreferences(data) });
      }

      hydratedRef.current = true;
      setLoading(false);
    }

    loadPreferences();

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user || !hydratedRef.current) return undefined;

    const timeout = setTimeout(async () => {
      const row = mapPreferencesToRow(user.id, preferences);
      const { error } = await supabase.from('user_settings').upsert(row, { onConflict: 'user_id' });
      if (error) {
        console.error('[useCommanderPreferences] save:', error.message);
      }
    }, 250);

    return () => clearTimeout(timeout);
  }, [preferences, user]);

  // Handle CSS Class Injection for Themes
  useEffect(() => {
    if (preferences.themePreference === 'aurora-light') {
      document.documentElement.classList.add('aurora-light');
    } else {
      document.documentElement.classList.remove('aurora-light');
    }
  }, [preferences.themePreference]);

  function patchPreference(key, value) {
    setPreferences((prev) => ({ ...prev, [key]: value }));
  }

  const api = useMemo(() => ({
    ...preferences,
    loading,
    setHumanHourlyRate: (value) => {
      const numeric = Number(value);
      patchPreference('humanHourlyRate', Number.isFinite(numeric) && numeric > 0 ? numeric : DEFAULTS.humanHourlyRate);
    },
    setCommandStyle: (value) => patchPreference('commandStyle', value || DEFAULTS.commandStyle),
    setAlertPosture: (value) => patchPreference('alertPosture', value || DEFAULTS.alertPosture),
    setQuietHoursEnabled: (value) => patchPreference('quietHoursEnabled', Boolean(value)),
    setQuietHoursStart: (value) => patchPreference('quietHoursStart', value || DEFAULTS.quietHoursStart),
    setQuietHoursEnd: (value) => patchPreference('quietHoursEnd', value || DEFAULTS.quietHoursEnd),
    setNotificationRoute: (value) => patchPreference('notificationRoute', value || DEFAULTS.notificationRoute),
    setSlackWebhookUrl: (value) => patchPreference('slackWebhookUrl', value || ''),
    setNotificationEmail: (value) => patchPreference('notificationEmail', value || ''),
    setThemePreference: (value) => patchPreference('themePreference', value || DEFAULTS.themePreference),
    setCommanderPersona: (value) => patchPreference('commanderPersona', value || DEFAULTS.commanderPersona),
    setTrustedWriteMode: (value) => patchPreference('trustedWriteMode', value || DEFAULTS.trustedWriteMode),
    setApprovalDoctrine: (value) => patchPreference('approvalDoctrine', value || DEFAULTS.approvalDoctrine),
  }), [loading, preferences]);

  return api;
}

