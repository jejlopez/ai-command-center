import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SettingsPanel } from '../components/SettingsPanel';
import { usePreferences } from '../context/PreferenceContext';
import { useConnectedSystems } from '../utils/useSupabase';
import React from 'react';

// Mock the hooks
vi.mock('../context/PreferenceContext', () => ({
  usePreferences: vi.fn(),
}));
vi.mock('../utils/useSupabase', () => ({
  useConnectedSystems: vi.fn(),
  saveProviderCredential: vi.fn(),
  ensureProviderInfrastructure: vi.fn(),
}));

describe('Settings Component - Synchronization & Real Data Doctrine', () => {
  const mockPrefs = {
    alertPosture: 'balanced',
    setAlertPosture: vi.fn(),
    notificationRoute: 'command_center',
    setNotificationRoute: vi.fn(),
    slackWebhookUrl: 'https://hooks.slack.com/xxx',
    setSlackWebhookUrl: vi.fn(),
    notificationEmail: 'acalvotriplet@gmail.com',
    setNotificationEmail: vi.fn(),
    quietHoursEnabled: true,
    setQuietHoursEnabled: vi.fn(),
    quietHoursStart: '22:00',
    setQuietHoursStart: vi.fn(),
    quietHoursEnd: '08:00',
    setQuietHoursEnd: vi.fn(),
    themePreference: 'obsidian',
    setThemePreference: vi.fn(),
  };

  const mockConnectedSystems = {
    connectedSystems: [
      {
        id: '1',
        integrationKey: 'openai',
        displayName: 'OpenAI',
        category: 'Models',
        identifier: 'primary-gpt4',
        status: 'connected',
        metadata: { tone: 'teal' }
      }
    ],
    loading: false,
    upsertSystem: vi.fn(),
    removeSystem: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    usePreferences.mockReturnValue(mockPrefs);
    useConnectedSystems.mockReturnValue(mockConnectedSystems);
  });

  it('verifies that settings are initialized from global persistent state (Zero Mock Data)', () => {
    render(<SettingsPanel settingsOpen={true} setSettingsOpen={vi.fn()} />);
    
    // Check if real data from usePreferences is rendered
    expect(screen.getByText('Balanced')).toBeDefined();
    expect(screen.getByText('App')).toBeDefined();
    expect(screen.getByDisplayValue('22:00')).toBeDefined();
  });

  it('verifies that changing an alert level triggers a persistent update call', async () => {
    render(<SettingsPanel settingsOpen={true} setSettingsOpen={vi.fn()} />);
    
    // Find the 'Critical' option in Alert Level
    const criticalButton = screen.getByText('Critical');
    fireEvent.click(criticalButton);

    expect(mockPrefs.setAlertPosture).toHaveBeenCalledWith('critical_only');
  });

  it('verifies dynamic rendering of Slack configuration when route is selected', async () => {
    mockPrefs.notificationRoute = 'slack';
    render(<SettingsPanel settingsOpen={true} setSettingsOpen={vi.fn()} />);
    
    expect(screen.getByText('Webhook Endpoint')).toBeDefined();
    expect(screen.getByDisplayValue('https://hooks.slack.com/xxx')).toBeDefined();
  });

  it('verifies masked key display for established connections', () => {
    render(<SettingsPanel settingsOpen={true} setSettingsOpen={vi.fn()} />);
    
    // The MaskedKey component renders within connection items
    expect(screen.getByText(/Secure API Key/i)).toBeDefined();
  });

  it('ensures full-width bento grid structure for tactical cards', () => {
    const { container } = render(<SettingsPanel settingsOpen={true} setSettingsOpen={vi.fn()} />);
    
    // Check for col-span-2 classes on tactical cards
    const tacticalCards = container.querySelectorAll('.md\\:col-span-2');
    // We have Interface, Alerts, Quiet Window, Master Vault -> should be at least 4
    expect(tacticalCards.length).toBeGreaterThanOrEqual(4);
  });
});
