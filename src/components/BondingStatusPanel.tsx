import React from 'react';
import { Activity, Shield, Zap, Wifi, Cable, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Language } from '../types';

interface BondingStatusPanelProps {
  language: Language;
  isConnected: boolean;
  pathMetrics: {
    ethernet: { rttMs: number; lossPercent: number; kbps: number };
    wifi: { rttMs: number; lossPercent: number; kbps: number };
  };
  relayIp: string;
  egressIp: string;
}

export const BondingStatusPanel: React.FC<BondingStatusPanelProps> = ({
  language,
  isConnected,
  pathMetrics,
  relayIp,
  egressIp,
}) => {
  const isAr = language === 'ar';
  const eth = pathMetrics.ethernet;
  const wifi = pathMetrics.wifi;

  return (
    <div className="rounded-3xl border border-slate-800/80 bg-slate-900/50 p-6 backdrop-blur-xl shadow-xl shadow-black/20">
      <div className="flex items-center gap-3 mb-5">
        <div className={`rounded-2xl p-3 ${isConnected ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
          {isConnected ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
        </div>
        <div>
          <h3 className="text-base font-bold text-white">
            {isAr ? 'حالة الدمج الأصلي (Native Bonding Status)' : 'Native Bonding Status'}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {isAr
              ? 'عرض حالة الاتصال وأداء كل مسار'
              : 'Monitor connection health and per-path performance'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-5">
        <div className="rounded-2xl bg-slate-950/60 p-4 border border-slate-800/60">
          <div className="text-xs text-slate-400 mb-1">
            {isAr ? 'حالة الاتصال' : 'Connection'}
          </div>
          <div className={`text-lg font-bold ${isConnected ? 'text-emerald-400' : 'text-red-400'}`}>
            {isConnected ? (isAr ? 'متصل ✓' : 'Connected ✓') : (isAr ? 'غير متصل ✗' : 'Disconnected ✗')}
          </div>
        </div>
        <div className="rounded-2xl bg-slate-950/60 p-4 border border-slate-800/60">
          <div className="text-xs text-slate-400 mb-1">
            {isAr ? 'عنوان الخروج (Egress IP)' : 'Egress IP'}
          </div>
          <div className="text-lg font-bold text-cyan-400 font-mono">{egressIp}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl bg-slate-950/60 p-4 border border-cyan-500/20">
          <div className="flex items-center gap-2 mb-3">
            <Cable className="h-4 w-4 text-cyan-400" />
            <span className="text-xs font-bold text-cyan-300">
              {isAr ? 'كابل الإيثرنت' : 'Ethernet'}
            </span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">{isAr ? 'زمن الاستجابة' : 'RTT'}</span>
              <span className="font-mono text-cyan-300">{eth.rttMs.toFixed(1)} ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">{isAr ? 'فقدان الحزم' : 'Loss'}</span>
              <span className="font-mono text-cyan-300">{eth.lossPercent.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">{isAr ? 'السرعة' : 'Speed'}</span>
              <span className="font-mono text-cyan-300">{(eth.kbps / 1000).toFixed(1)} Mbps</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-slate-950/60 p-4 border border-emerald-500/20">
          <div className="flex items-center gap-2 mb-3">
            <Wifi className="h-4 w-4 text-emerald-400" />
            <span className="text-xs font-bold text-emerald-300">
              {isAr ? 'الواي فاي' : 'Wi-Fi'}
            </span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">{isAr ? 'زمن الاستجابة' : 'RTT'}</span>
              <span className="font-mono text-emerald-300">{wifi.rttMs.toFixed(1)} ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">{isAr ? 'فقدان الحزم' : 'Loss'}</span>
              <span className="font-mono text-emerald-300">{wifi.lossPercent.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">{isAr ? 'السرعة' : 'Speed'}</span>
              <span className="font-mono text-emerald-300">{(wifi.kbps / 1000).toFixed(1)} Mbps</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-slate-950/40 p-3 border border-slate-800/50">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Shield className="h-3.5 w-3.5 text-amber-400" />
          <span>
            {isAr
              ? `Relay: ${relayIp} • التشفير: TLS 1.3 • البروتوكول: QUIC DATAGRAM`
              : `Relay: ${relayIp} • Encryption: TLS 1.3 • Protocol: QUIC DATAGRAM`}
          </span>
        </div>
      </div>
    </div>
  );
};
