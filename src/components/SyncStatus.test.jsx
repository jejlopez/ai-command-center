import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import SyncStatus from './SyncStatus';

describe('SyncStatus Component', () => {
  it('renders the correct text', () => {
    render(<SyncStatus />);
    expect(screen.getByText('System Synced')).toBeDefined();
  });

  it('contains the pulsing indicator', () => {
    const { container } = render(<SyncStatus />);
    const pulses = container.getElementsByClassName('animate-ping');
    expect(pulses.length).toBe(1);
  });
});
