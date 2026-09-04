import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DiagnosticsPanel } from './DiagnosticsPanel';

// Mock EventSource globally
class MockEventSource {
  onopen: () => void = () => {};
  onmessage: (event: any) => void = () => {};
  onerror: () => void = () => {};
  close = vi.fn();
  constructor(url: string) {
    setTimeout(() => {
        if (this.onopen) this.onopen();
    }, 0);
  }
}
global.EventSource = MockEventSource as any;

const mockProps = {
  language: 'en' as const,
  ethernetConfig: { ipAddress: '192.168.1.100', interfaceName: 'eth0', status: 'connected' as const, type: 'ethernet' as const },
  wifiConfig: { ipAddress: '192.168.1.101', interfaceName: 'wlan0', status: 'connected' as const, type: 'wifi' as const }
};

describe('DiagnosticsPanel', () => {
  beforeEach(() => {
    // Mock global fetch
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders without crashing', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ events: [], logFile: 'test.log' })
    });

    await act(async () => {
      render(<DiagnosticsPanel {...mockProps} />);
    });

    expect(screen.getByText('Live System Diagnostics Log')).toBeInTheDocument();
  });

  describe('captureSnapshot error handling', () => {
    it('handles Standard Error rejection', async () => {
      // 1. First fetch (useEffect mount) resolves fine
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ events: [], logFile: 'test.log' })
      });

      await act(async () => {
        render(<DiagnosticsPanel {...mockProps} />);
      });

      // 2. Second fetch (button click) rejects with an Error object
      (global.fetch as any).mockRejectedValueOnce(new Error('Network failure'));

      await act(async () => {
        fireEvent.click(screen.getByText('Capture Snapshot'));
      });

      // 3. Verify the error message is displayed
      expect(await screen.findByText(/Diagnosis:/)).toBeInTheDocument();
      expect(screen.getByText(/Network failure/)).toBeInTheDocument();
    });

    it('handles non-Error rejection (string fallback)', async () => {
      // 1. First fetch (useEffect mount) resolves fine
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ events: [], logFile: 'test.log' })
      });

      await act(async () => {
        render(<DiagnosticsPanel {...mockProps} />);
      });

      // 2. Second fetch (button click) rejects with a string or non-Error
      (global.fetch as any).mockRejectedValueOnce('Some string error');

      await act(async () => {
        fireEvent.click(screen.getByText('Capture Snapshot'));
      });

      // 3. Verify the fallback "Snapshot failed" message is displayed
      expect(await screen.findByText(/Diagnosis:/)).toBeInTheDocument();
      expect(screen.getByText(/Snapshot failed/)).toBeInTheDocument();
    });

    it('handles API response failure (success=false)', async () => {
      // 1. First fetch (useEffect mount) resolves fine
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ events: [], logFile: 'test.log' })
      });

      await act(async () => {
        render(<DiagnosticsPanel {...mockProps} />);
      });

      // 2. Second fetch (button click) resolves but with ok=false or success=false
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: false, error: 'Custom API Error' })
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Capture Snapshot'));
      });

      // 3. Verify the message is extracted correctly based on the payload error
      expect(await screen.findByText(/Diagnosis:/)).toBeInTheDocument();
      expect(screen.getByText(/Custom API Error/)).toBeInTheDocument();
    });
  });
});
