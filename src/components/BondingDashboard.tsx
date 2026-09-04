import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Square,
  Wifi,
  Cable,
  Zap,
  ShieldCheck,
  Activity,
  ArrowDownCircle,
  ArrowUpCircle,
  Power,
  PowerOff,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  TrendingUp,
  Server
} from 'lucide-react';

interface BondingStatus {
  isActive: boolean;
  wintunCreated: boolean;
  sessionStarted: boolean;
  ethernetPath: {
    ip: string;
    status: 'connected' | 'disconnected';
    rxBytes: number;
    txBytes: number;
    rxSpeed: number;
    txSpeed: number;
    latencyMs: number;
  };
  wifiPath: {
    ip: string;
    status: 'connected' | 'disconnected';
    rxBytes: number;
    txBytes: number;
    rxSpeed: number;
    txSpeed: number;
    latencyMs: number;
  };
  relay: {
    host: string;
    port: number;
    status: 'connected' | 'disconnected';
  };
  totalRxSpeed: number;
  totalTxSpeed: number;
  publicIp: string;
  uptimeSec: number;
}

interface SpeedTestResult {
  pingMs: number;
  jitterMs: number;
  downloadMbps: number;
  uploadMbps: number;
}

interface BondingDashboardProps {
  language: 'ar' | 'en';
}

const BondingDashboard: React.FC<BondingDashboardProps> = ({ language }) => {
  const isAr = language === 'ar';
  const [status, setStatus] = useState<BondingStatus>({
    isActive: false,
    wintunCreated: false,
    sessionStarted: false,
    ethernetPath: {
      ip: '192.168.8.20',
      status: 'disconnected',
      rxBytes: 0,
      txBytes: 0,
      rxSpeed: 0,
      txSpeed: 0,
      latencyMs: 0,
    },
    wifiPath: {
      ip: '192.168.1.22',
      status: 'disconnected',
      rxBytes: 0,
      txBytes: 0,
      rxSpeed: 0,
      txSpeed: 0,
      latencyMs: 0,
    },
    relay: {
      host: '84.8.105.228',
      port: 8443,
      status: 'disconnected',
    },
    totalRxSpeed: 0,
    totalTxSpeed: 0,
    publicIp: '0.0.0.0',
    uptimeSec: 0,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speedTestRunning, setSpeedTestRunning] = useState(false);
  const [speedTestResult, setSpeedTestResult] = useState<SpeedTestResult | null>(null);
  const uptimeRef = useRef<NodeJS.Timeout | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Poll status from backend
  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/bonding/status');
      const data = await res.json();
      setStatus(data);
      setError(null);
    } catch (e) {
      setError(isAr ? 'فشل في جلب حالة النظام' : 'Failed to fetch status');
    }
  };

  useEffect(() => {
    fetchStatus();
    pollRef.current = setInterval(fetchStatus, 2000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (uptimeRef.current) clearInterval(uptimeRef.current);
    };
  }, []);

  // Uptime counter
  useEffect(() => {
    if (status.isActive) {
      uptimeRef.current = setInterval(() => {
        setStatus(prev => ({ ...prev, uptimeSec: prev.uptimeSec + 1 }));
      }, 1000);
    } else {
      if (uptimeRef.current) clearInterval(uptimeRef.current);
    }
    return () => {
      if (uptimeRef.current) clearInterval(uptimeRef.current);
    };
  }, [status.isActive]);

  const activate = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/bonding/activate', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setStatus(prev => ({ ...prev, isActive: true }));
      } else {
        setError(data.error || (isAr ? 'فشل التفعيل' : 'Activation failed'));
      }
    } catch (e) {
      setError(isAr ? 'فشل الاتصال بالخادم' : 'Connection failed');
    }
    setIsLoading(false);
  };

  const deactivate = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/bonding/deactivate', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setStatus(prev => ({ ...prev, isActive: false, uptimeSec: 0 }));
      } else {
        setError(data.error || (isAr ? 'فشل الإيقاف' : 'Deactivation failed'));
      }
    } catch (e) {
      setError(isAr ? 'فشل الاتصال بالخادم' : 'Connection failed');
    }
    setIsLoading(false);
  };

  const runSpeedTest = async () => {
    setSpeedTestRunning(true);
    setSpeedTestResult(null);
    try {
      const res = await fetch('/api/speedtest', { method: 'POST' });
      const data = await res.json();
      setSpeedTestResult(data);
    } catch (e) {
      setError(isAr ? 'فشل اختبار السرعة' : 'Speed test failed');
    }
    setSpeedTestRunning(false);
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  };

  const formatUptime = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatSpeed = (mbps: number) => {
    if (mbps >= 1000) return `${(mbps / 1000).toFixed(2)} Gbps`;
    return `${mbps.toFixed(1)} Mbps`;
  };

  return (
    <div className="space-y-6">
      {/* Header / Master Toggle */}
      <div className="rounded-3xl border border-slate-800/80 bg-slate-900/50 p-6 backdrop-blur-xl shadow-xl shadow-black/20">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
              <ShieldCheck className="h-6 w-6 text-cyan-400" />
              {isAr ? 'لوحة تحكم BondLink' : 'BondLink Dashboard'}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {isAr 
                ? 'تحكم في دمج السرعات وراقب الترافيك لحظياً'
                : 'Control speed bonding and monitor traffic in real-time'}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${
              status.isActive 
                ? 'bg-emerald-500/20 border border-emerald-500/40' 
                : 'bg-red-500/20 border border-red-500/40'
            }`}>
              {status.isActive ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-400" />
              )}
              <span className={`text-sm font-bold ${
                status.isActive ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {status.isActive ? (isAr ? 'نشط' : 'ACTIVE') : (isAr ? 'متوقف' : 'INACTIVE')}
              </span>
            </div>

            <button
              onClick={status.isActive ? deactivate : activate}
              disabled={isLoading}
              className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all ${
                status.isActive
                  ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/25'
                  : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/25'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {status.isActive ? (
                <>
                  <PowerOff className="h-5 w-5" />
                  {isAr ? 'إيقاف' : 'STOP'}
                </>
              ) : (
                <>
                  <Power className="h-5 w-5" />
                  {isAr ? 'تشغيل' : 'START'}
                </>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Total Speed Display */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Combined Download */}
        <div className="rounded-2xl border border-cyan-900/40 bg-cyan-950/20 p-6 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-cyan-300 flex items-center gap-1.5">
              <ArrowDownCircle className="h-4 w-4 text-cyan-400" />
              {isAr ? 'التحميل المجمع' : 'Combined Download'}
            </span>
            <Activity className={`h-4 w-4 text-cyan-400 ${status.isActive ? 'animate-pulse' : ''}`} />
          </div>
          <div className="mt-2 font-mono text-4xl font-extrabold text-cyan-300">
            {formatSpeed(status.totalRxSpeed)}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {formatBytes(status.ethernetPath.rxBytes + status.wifiPath.rxBytes)} {isAr ? 'مستلمة' : 'received'}
          </div>
        </div>

        {/* Combined Upload */}
        <div className="rounded-2xl border border-emerald-900/40 bg-emerald-950/20 p-6 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
              <ArrowUpCircle className="h-4 w-4 text-emerald-400" />
              {isAr ? 'الرفع المجمع' : 'Combined Upload'}
            </span>
            <Activity className={`h-4 w-4 text-emerald-400 ${status.isActive ? 'animate-pulse' : ''}`} />
          </div>
          <div className="mt-2 font-mono text-4xl font-extrabold text-emerald-300">
            {formatSpeed(status.totalTxSpeed)}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {formatBytes(status.ethernetPath.txBytes + status.wifiPath.txBytes)} {isAr ? 'مرفوعة' : 'sent'}
          </div>
        </div>

        {/* Public IP */}
        <div className="rounded-2xl border border-amber-900/40 bg-amber-950/20 p-6 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
              <Server className="h-4 w-4 text-amber-400" />
              {isAr ? 'الـIP العام' : 'Public IP'}
            </span>
            <Clock className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 font-mono text-3xl font-extrabold text-amber-300">
            {status.publicIp}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {isAr ? 'وقت التشغيل' : 'Uptime'}: {formatUptime(status.uptimeSec)}
          </div>
        </div>
      </div>

      {/* Interface Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Ethernet Path */}
        <div className="rounded-3xl border border-cyan-900/40 bg-slate-900/50 p-6 backdrop-blur-xl shadow-xl shadow-black/20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Cable className="h-5 w-5 text-cyan-400" />
              {isAr ? 'كابل الإيثرنت' : 'Ethernet'}
            </h3>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
              status.ethernetPath.status === 'connected'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                : 'bg-red-500/20 text-red-400 border border-red-500/40'
            }`}>
              {status.ethernetPath.status === 'connected' 
                ? (isAr ? 'متصل' : 'CONNECTED') 
                : (isAr ? 'غير متصل' : 'DISCONNECTED')}
            </span>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">{isAr ? 'العنوان' : 'IP'}:</span>
              <span className="font-mono text-cyan-300">{status.ethernetPath.ip}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">{isAr ? 'سرعة التحميل' : 'Download'}:</span>
              <span className="font-mono text-cyan-300">{formatSpeed(status.ethernetPath.rxSpeed)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">{isAr ? 'سرعة الرفع' : 'Upload'}:</span>
              <span className="font-mono text-cyan-300">{formatSpeed(status.ethernetPath.txSpeed)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">{isAr ? 'التأخير' : 'Latency'}:</span>
              <span className="font-mono text-cyan-300">{status.ethernetPath.latencyMs} ms</span>
            </div>
          </div>
        </div>

        {/* Wi-Fi Path */}
        <div className="rounded-3xl border border-emerald-900/40 bg-slate-900/50 p-6 backdrop-blur-xl shadow-xl shadow-black/20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Wifi className="h-5 w-5 text-emerald-400" />
              {isAr ? 'الواي فاي' : 'Wi-Fi'}
            </h3>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
              status.wifiPath.status === 'connected'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                : 'bg-red-500/20 text-red-400 border border-red-500/40'
            }`}>
              {status.wifiPath.status === 'connected' 
                ? (isAr ? 'متصل' : 'CONNECTED') 
                : (isAr ? 'غير متصل' : 'DISCONNECTED')}
            </span>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">{isAr ? 'العنوان' : 'IP'}:</span>
              <span className="font-mono text-emerald-300">{status.wifiPath.ip}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">{isAr ? 'سرعة التحميل' : 'Download'}:</span>
              <span className="font-mono text-emerald-300">{formatSpeed(status.wifiPath.rxSpeed)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">{isAr ? 'سرعة الرفع' : 'Upload'}:</span>
              <span className="font-mono text-emerald-300">{formatSpeed(status.wifiPath.txSpeed)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">{isAr ? 'التأخير' : 'Latency'}:</span>
              <span className="font-mono text-emerald-300">{status.wifiPath.latencyMs} ms</span>
            </div>
          </div>
        </div>
      </div>

      {/* Speed Test */}
      <div className="rounded-3xl border border-slate-800/80 bg-slate-900/50 p-6 backdrop-blur-xl shadow-xl shadow-black/20">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-amber-400" />
              {isAr ? 'اختبار السرعة' : 'Speed Test'}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {isAr 
                ? 'اختبر السرعة الحقيقية للاتصال المجمع عبر السيرفر'
                : 'Test real bonded speed through the relay server'}
            </p>
          </div>
          <button
            onClick={runSpeedTest}
            disabled={speedTestRunning || !status.isActive}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:from-amber-400 hover:to-orange-400 transition-all shadow-lg shadow-amber-500/25"
          >
            {speedTestRunning ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            {speedTestRunning 
              ? (isAr ? 'جاري الاختبار...' : 'Testing...') 
              : (isAr ? 'اختبار السرعة' : 'Run Speed Test')}
          </button>
        </div>

        {speedTestResult && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4 text-center">
              <div className="text-xs text-slate-400 mb-1">{isAr ? 'التحميل' : 'Download'}</div>
              <div className="font-mono text-2xl font-bold text-cyan-300">
                {speedTestResult.downloadMbps.toFixed(1)}
              </div>
              <div className="text-xs text-slate-500">Mbps</div>
            </div>
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4 text-center">
              <div className="text-xs text-slate-400 mb-1">{isAr ? 'الرفع' : 'Upload'}</div>
              <div className="font-mono text-2xl font-bold text-emerald-300">
                {speedTestResult.uploadMbps.toFixed(1)}
              </div>
              <div className="text-xs text-slate-500">Mbps</div>
            </div>
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4 text-center">
              <div className="text-xs text-slate-400 mb-1">{isAr ? 'البنق' : 'Ping'}</div>
              <div className="font-mono text-2xl font-bold text-amber-300">
                {speedTestResult.pingMs.toFixed(1)}
              </div>
              <div className="text-xs text-slate-500">ms</div>
            </div>
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4 text-center">
              <div className="text-xs text-slate-400 mb-1">{isAr ? 'الجيتتر' : 'Jitter'}</div>
              <div className="font-mono text-2xl font-bold text-orange-300">
                {speedTestResult.jitterMs.toFixed(1)}
              </div>
              <div className="text-xs text-slate-500">ms</div>
            </div>
          </div>
        )}
      </div>

      {/* System Info */}
      <div className="rounded-3xl border border-slate-800/80 bg-slate-900/50 p-6 backdrop-blur-xl shadow-xl shadow-black/20">
        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <Server className="h-4 w-4 text-cyan-400" />
          {isAr ? 'معلومات النظام' : 'System Info'}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-slate-400">{isAr ? 'السيرفر' : 'Relay'}:</span>
            <span className="ml-2 font-mono text-slate-200">{status.relay.host}:{status.relay.port}</span>
          </div>
          <div>
            <span className="text-slate-400">{isAr ? 'Wintun' : 'Wintun'}:</span>
            <span className={`ml-2 ${status.wintunCreated ? 'text-emerald-400' : 'text-red-400'}`}>
              {status.wintunCreated ? (isAr ? 'مُنشأ' : 'Created') : (isAr ? 'غير مُنشأ' : 'Not Created')}
            </span>
          </div>
          <div>
            <span className="text-slate-400">{isAr ? 'الجلسة' : 'Session'}:</span>
            <span className={`ml-2 ${status.sessionStarted ? 'text-emerald-400' : 'text-red-400'}`}>
              {status.sessionStarted ? (isAr ? 'نشطة' : 'Started') : (isAr ? 'متوقفة' : 'Stopped')}
            </span>
          </div>
          <div>
            <span className="text-slate-400">{isAr ? 'حالة السيرفر' : 'Relay Status'}:</span>
            <span className={`ml-2 ${status.relay.status === 'connected' ? 'text-emerald-400' : 'text-red-400'}`}>
              {status.relay.status === 'connected' ? (isAr ? 'متصل' : 'Connected') : (isAr ? 'غير متصل' : 'Disconnected')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BondingDashboard;
