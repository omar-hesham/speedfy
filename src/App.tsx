/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { SpeedTestEngine } from './components/SpeedTestEngine';
import { ServerSetupGenerator } from './components/ServerSetupGenerator';
import { NetworkInterfacesPanel } from './components/NetworkInterfacesPanel';
import { BandwidthCalculator } from './components/BandwidthCalculator';
import { BondingExplainer } from './components/BondingExplainer';
import { BondingStatusPanel } from './components/BondingStatusPanel';
import BondingDashboard from './components/BondingDashboard';
import { Language, NetworkInterfaceConfig } from './types';
import { Zap, Cable, Wifi, Terminal, HelpCircle, LayoutDashboard } from 'lucide-react';

export default function App() {
  const [language, setLanguage] = useState<Language>('ar');
  const [currentTab, setCurrentTab] = useState<string>('dashboard');

  // Interface 1: Local Link / Ethernet
  const [ethernetConfig, setEthernetConfig] = useState<NetworkInterfaceConfig>({
    id: 'eth0',
    name: 'Ethernet Adapter',
    type: 'ethernet',
    ipAddress: '192.168.8.20',
    gateway: '192.168.8.1',
    subnetMask: '255.255.255.0',
    metric: 15,
    nominalSpeedMbps: 1000,
    currentSpeedMbps: 0,
    latencyMs: 6,
    jitterMs: 1.2,
    packetLossPercent: 0,
    isActive: true,
    macAddress: '02-00-00-00-00-01'
  });

  // Interface 2: Wi-Fi (Secondary Router / 5GHz)
  const [wifiConfig, setWifiConfig] = useState<NetworkInterfaceConfig>({
    id: 'wlan0',
    name: 'Wi-Fi Adapter',
    type: 'wifi',
    ipAddress: '192.168.1.22',
    gateway: '192.168.1.1',
    subnetMask: '255.255.255.0',
    metric: 15,
    nominalSpeedMbps: 702,
    currentSpeedMbps: 0,
    latencyMs: 12,
    jitterMs: 2.4,
    packetLossPercent: 0,
    isActive: true,
    macAddress: '02-00-00-00-00-02',
    wifiSsid: 'Secondary-WiFi',
    wifiSignalDbm: -48,
    wifiFrequency: '5.0 GHz'
  });

  // Sync RTL and lang attribute on <html> element
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  }, [language]);

  const combinedSpeed = (ethernetConfig.isActive ? ethernetConfig.nominalSpeedMbps : 0) + 
                        (wifiConfig.isActive ? wifiConfig.nominalSpeedMbps : 0);

  const isAr = language === 'ar';

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100 flex flex-col selection:bg-cyan-500/30 selection:text-cyan-200 sleek-bg-glow relative overflow-x-hidden">
      
      {/* Ambient background blur elements for Sleek Interface depth */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed top-1/3 right-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed bottom-10 left-1/3 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Navigation Header */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        language={language}
        setLanguage={setLanguage}
        isEthActive={ethernetConfig.isActive}
        isWifiActive={wifiConfig.isActive}
        combinedSpeed={combinedSpeed}
      />

      {/* Main App Content Area */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        {currentTab === 'dashboard' && (
          <BondingDashboard language={language} />
        )}

        {currentTab === 'speedtest' && (
          <SpeedTestEngine
            language={language}
            ethernetConfig={ethernetConfig}
            wifiConfig={wifiConfig}
            onNavigateToSetup={() => setCurrentTab('server-setup')}
          />
        )}

        {currentTab === 'server-setup' && (
          <ServerSetupGenerator
            language={language}
            ethernetConfig={ethernetConfig}
            wifiConfig={wifiConfig}
          />
        )}

        {currentTab === 'interfaces' && (
          <NetworkInterfacesPanel
            language={language}
          />
        )}

        {currentTab === 'calculator' && (
          <BandwidthCalculator
            language={language}
            ethSpeed={ethernetConfig.nominalSpeedMbps}
            wifiSpeed={wifiConfig.nominalSpeedMbps}
          />
        )}

        {currentTab === 'explainer' && (
          <BondingExplainer
            language={language}
            onNavigateToSetup={() => setCurrentTab('server-setup')}
          />
        )}

        {currentTab === 'bonding-status' && (
          <BondingStatusPanel
            language={language}
            isConnected={false}
            pathMetrics={{
              ethernet: {
                rttMs: ethernetConfig.latencyMs,
                lossPercent: ethernetConfig.packetLossPercent,
                kbps: ethernetConfig.nominalSpeedMbps * 1000,
              },
              wifi: {
                rttMs: wifiConfig.latencyMs,
                lossPercent: wifiConfig.packetLossPercent,
                kbps: wifiConfig.nominalSpeedMbps * 1000,
              },
            }}
            relayIp="203.0.113.10"
            egressIp="198.51.100.1"
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/60 bg-slate-950/70 backdrop-blur-md py-6 text-xs text-slate-400">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
            </span>
            <span className="font-mono text-slate-300 font-bold tracking-tight">BondLink Dual-NIC Engine</span>
            <span className="text-slate-600">—</span>
            <span className="text-slate-400">{isAr ? 'دمج سرعة كابل اللان والواي فاي معاً' : 'Ethernet & Wi-Fi Combined Speed'}</span>
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <button 
              onClick={() => setCurrentTab('server-setup')} 
              className="text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1.5 font-medium"
            >
              <Terminal className="h-3 w-3" />
              {isAr ? 'تشغيل السيرفر المحلي' : 'Local Server Scripts'}
            </button>
            <span className="text-slate-800">•</span>
            <button 
              onClick={() => setCurrentTab('explainer')} 
              className="text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1.5 font-medium"
            >
              <HelpCircle className="h-3 w-3" />
              {isAr ? 'دليل الاستخدام' : 'Documentation'}
            </button>
          </div>
        </div>
      </footer>

    </div>
  );
}
