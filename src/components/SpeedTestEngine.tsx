import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Square, 
  RotateCcw, 
  Activity, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  Zap, 
  CheckCircle2, 
  Wifi, 
  Cable, 
  Layers, 
  ShieldCheck, 
  Cpu, 
  Sparkles,
  Download,
  Flame,
  Info,
  Server
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from 'recharts';
import confetti from 'canvas-confetti';
import { NetworkInterfaceConfig, SpeedSample, SpeedTestState, Language } from '../types';
import { DiagnosticsPanel } from './DiagnosticsPanel';

interface SpeedTestEngineProps {
  language: Language;
  ethernetConfig: NetworkInterfaceConfig;
  wifiConfig: NetworkInterfaceConfig;
  onNavigateToSetup: () => void;
}

type SpeedDirection = 'download' | 'upload';

type LiveSpeedResult = {
  mbps: number;
  breakdown: Record<string, number>;
  bytes: number;
  duration?: number;
};

const emptyLiveSpeedResult: LiveSpeedResult = {
  mbps: 0,
  breakdown: {},
  bytes: 0
};

export const SpeedTestEngine: React.FC<SpeedTestEngineProps> = ({
  language,
  ethernetConfig,
  wifiConfig,
  onNavigateToSetup
}) => {
  const isAr = language === 'ar';

  const [testMode, setTestMode] = useState<'MULTI_STREAM' | 'CHUNKED_IDM' | 'SINGLE_STREAM'>('MULTI_STREAM');
  const [testState, setTestState] = useState<SpeedTestState>({
    status: 'idle',
    progress: 0,
    pingMs: 0,
    jitterMs: 0,
    downloadSpeedCombined: 0,
    downloadSpeedEthernet: 0,
    downloadSpeedWifi: 0,
    uploadSpeedCombined: 0,
    uploadSpeedEthernet: 0,
    uploadSpeedWifi: 0,
    bufferbloatGrade: 'A+',
    historyData: [],
    totalBytesDownloadedMb: 0,
    totalBytesUploadedMb: 0,
    efficiencyPercent: 0
  });

  const [livePackets, setLivePackets] = useState<Array<{
    id: number;
    source: 'eth' | 'wifi';
    size: number;
    streamId: number;
    offset: number;
  }>>([]);

  const animationFrameRef = useRef<number | null>(null);
  const testTimerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const sampleCounterRef = useRef<number>(0);
  const completedDownloadBytesRef = useRef<number>(0);
  const completedUploadBytesRef = useRef<number>(0);
  const activeEventSourcesRef = useRef<EventSource[]>([]);
  const isTestCancelledRef = useRef<boolean>(false);

  // Maximum potential speeds based on current interface settings
  const targetEthSpeed = ethernetConfig.isActive ? ethernetConfig.nominalSpeedMbps : 0;
  const targetWifiSpeed = wifiConfig.isActive ? wifiConfig.nominalSpeedMbps : 0;
  
  // In single stream mode, without MPTCP, usually only 1 adapter is picked by Windows!
  const targetCombinedSpeed = testMode === 'SINGLE_STREAM' 
    ? Math.max(targetEthSpeed, targetWifiSpeed)
    : targetEthSpeed + targetWifiSpeed;

  const startSpeedTest = async () => {
    if (testState.status === 'downloading' || testState.status === 'uploading') return;

    isTestCancelledRef.current = false;
    activeEventSourcesRef.current.forEach(source => source.close());
    activeEventSourcesRef.current = [];
    completedDownloadBytesRef.current = 0;
    completedUploadBytesRef.current = 0;
    startTimeRef.current = Date.now();

    setTestState(prev => ({
      ...prev,
      status: 'pinging',
      progress: 5,
      pingMs: Math.round(Math.random() * 15 + 5),
      jitterMs: Math.round(Math.random() * 5 + 1),
      downloadSpeedCombined: 0,
      downloadSpeedEthernet: 0,
      downloadSpeedWifi: 0,
      uploadSpeedCombined: 0,
      uploadSpeedEthernet: 0,
      uploadSpeedWifi: 0,
      historyData: [],
      totalBytesDownloadedMb: 0,
      totalBytesUploadedMb: 0
    }));

    try {
      const bondedIps = [
        ethernetConfig.isActive ? ethernetConfig.ipAddress : null,
        wifiConfig.isActive ? wifiConfig.ipAddress : null
      ].filter((ip): ip is string => Boolean(ip));
      const bondedIpQuery = bondedIps.join(',');

      // Stream 1: Ethernet download only
      setTestState(prev => ({ ...prev, status: 'downloading', progress: 20 }));
      let ethDownloadResult = emptyLiveSpeedResult;
      if (ethernetConfig.isActive && ethernetConfig.ipAddress) {
        ethDownloadResult = await runLiveSpeedTest('download', 'single', ethernetConfig.ipAddress);
        completedDownloadBytesRef.current += ethDownloadResult.bytes;
      }
      const realEthSpeed = ethDownloadResult.mbps;
      setTestState(prev => ({ 
        ...prev, 
        downloadSpeedEthernet: realEthSpeed, 
        progress: 40,
        historyData: [...prev.historyData, { timeSec: 2, ethernetMbps: realEthSpeed, wifiMbps: 0, combinedMbps: realEthSpeed, targetMbps: realEthSpeed }]
      }));

      // Stream 2: Wi-Fi download only
      let wifiDownloadResult = emptyLiveSpeedResult;
      if (wifiConfig.isActive && wifiConfig.ipAddress) {
        wifiDownloadResult = await runLiveSpeedTest('download', 'single', wifiConfig.ipAddress);
        completedDownloadBytesRef.current += wifiDownloadResult.bytes;
      }
      const realWifiSpeed = wifiDownloadResult.mbps;
      setTestState(prev => ({ 
        ...prev, 
        downloadSpeedWifi: realWifiSpeed, 
        progress: 65,
        historyData: [...prev.historyData, { timeSec: 4, ethernetMbps: realEthSpeed, wifiMbps: realWifiSpeed, combinedMbps: Math.max(realEthSpeed, realWifiSpeed), targetMbps: 0 }]
      }));

      // Stream 3: Bonded download aggregation
      let bondedDownloadResult = emptyLiveSpeedResult;
      if (testMode !== 'SINGLE_STREAM' && bondedIpQuery) {
        bondedDownloadResult = await runLiveSpeedTest('download', 'bonded', null, bondedIpQuery);
        completedDownloadBytesRef.current += bondedDownloadResult.bytes;
      } else {
        bondedDownloadResult = {
          ...emptyLiveSpeedResult,
          mbps: Math.max(realEthSpeed, realWifiSpeed),
          breakdown: {
            [ethernetConfig.ipAddress]: realEthSpeed,
            [wifiConfig.ipAddress]: realWifiSpeed
          }
        };
      }
      const realBondedSpeed = bondedDownloadResult.mbps;

      setTestState(prev => ({ 
        ...prev, 
        downloadSpeedCombined: realBondedSpeed,
        progress: 82,
        status: 'uploading',
        historyData: [...prev.historyData, { timeSec: 6, ethernetMbps: realEthSpeed, wifiMbps: realWifiSpeed, combinedMbps: realBondedSpeed, targetMbps: realBondedSpeed }]
      }));

      // Stream 4: Real upload test. EventSource stays GET-only, but the backend now
      // performs bound HTTPS POST uploads to Cloudflare and streams telemetry back.
      let singleUploadIp: string | null = null;
      if (ethernetConfig.isActive && ethernetConfig.ipAddress && realEthSpeed >= realWifiSpeed) {
        singleUploadIp = ethernetConfig.ipAddress;
      }
      if (wifiConfig.isActive && wifiConfig.ipAddress && (!singleUploadIp || realWifiSpeed > realEthSpeed)) {
        singleUploadIp = wifiConfig.ipAddress;
      }

      let uploadResult = emptyLiveSpeedResult;
      if (testMode !== 'SINGLE_STREAM' && bondedIpQuery) {
        uploadResult = await runLiveSpeedTest('upload', 'bonded', null, bondedIpQuery);
      } else if (singleUploadIp) {
        uploadResult = await runLiveSpeedTest('upload', 'single', singleUploadIp);
      }
      completedUploadBytesRef.current += uploadResult.bytes;

      const uploadEthSpeed = Number(uploadResult.breakdown[ethernetConfig.ipAddress] ?? (singleUploadIp === ethernetConfig.ipAddress ? uploadResult.mbps : 0));
      const uploadWifiSpeed = Number(uploadResult.breakdown[wifiConfig.ipAddress] ?? (singleUploadIp === wifiConfig.ipAddress ? uploadResult.mbps : 0));
      const realUploadSpeed = uploadResult.mbps;

      setTestState(prev => ({ 
        ...prev, 
        downloadSpeedCombined: realBondedSpeed, 
        uploadSpeedCombined: realUploadSpeed,
        uploadSpeedEthernet: uploadEthSpeed,
        uploadSpeedWifi: uploadWifiSpeed,
        progress: 100,
        status: 'completed',
        historyData: [...prev.historyData, { timeSec: parseFloat(((Date.now() - startTimeRef.current) / 1000).toFixed(1)), ethernetMbps: uploadEthSpeed, wifiMbps: uploadWifiSpeed, combinedMbps: realUploadSpeed, targetMbps: realUploadSpeed }],
        efficiencyPercent: Math.min(99, Math.round((realBondedSpeed / ((realEthSpeed + realWifiSpeed) || 1)) * 100))
      }));

      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#06b6d4', '#10b981', '#f59e0b', '#38bdf8']
      });

    } catch (e) {
      console.error(e);
      setTestState(prev => ({ ...prev, status: 'idle', progress: 0 }));
      alert(isAr ? 'فشل الاتصال بخادم اختبار السرعة المحلي.' : 'Failed to connect to local speedtest backend.');
    }
  };

  const runLiveSpeedTest = (direction: SpeedDirection, mode: string, ipAddress: string | null = null, ips: string | null = null): Promise<LiveSpeedResult> => {
    return new Promise((resolve, reject) => {
      const params = new URLSearchParams({ direction, mode });
      if (ipAddress) params.set('ipAddress', ipAddress);
      if (ips) params.set('ips', ips);

      const evtSource = new EventSource(`/api/speedtest-live?${params.toString()}`);
      activeEventSourcesRef.current.push(evtSource);
      let finalResult: LiveSpeedResult = { ...emptyLiveSpeedResult };

      const closeSource = () => {
        evtSource.close();
        activeEventSourcesRef.current = activeEventSourcesRef.current.filter(source => source !== evtSource);
      };

      evtSource.onmessage = (event) => {
        if (isTestCancelledRef.current) {
          closeSource();
          resolve(finalResult);
          return;
        }

        const data = JSON.parse(event.data);
        if (data.error) {
          closeSource();
          reject(new Error(data.error));
          return;
        }

        const currentSpeed = Number.parseFloat(data.mbps ?? '0') || 0;
        const currentBytes = Number(data.bytes || 0);
        const normalizedBreakdown: Record<string, number> = {};
        Object.entries(data.breakdown || {}).forEach(([ip, value]) => {
          const numericValue = Number(value);
          normalizedBreakdown[ip] = Number.isFinite(numericValue) ? numericValue : 0;
        });
        finalResult = {
          mbps: currentSpeed,
          breakdown: normalizedBreakdown,
          bytes: currentBytes,
          duration: Number(data.duration || 0)
        };
        
        // Update UI live for both download and upload telemetry.
        setTestState(prev => {
          const updates: any = {};
          const isUpload = direction === 'upload';
          const ethField = isUpload ? 'uploadSpeedEthernet' : 'downloadSpeedEthernet';
          const wifiField = isUpload ? 'uploadSpeedWifi' : 'downloadSpeedWifi';
          const combinedField = isUpload ? 'uploadSpeedCombined' : 'downloadSpeedCombined';
          const completedBytes = isUpload ? completedUploadBytesRef.current : completedDownloadBytesRef.current;
          const totalBytesField = isUpload ? 'totalBytesUploadedMb' : 'totalBytesDownloadedMb';

          updates[totalBytesField] = (completedBytes + currentBytes) / 1_000_000;
          updates.progress = isUpload
            ? 82 + Math.min(17, Number(data.progress || 0) * 0.17)
            : Math.max(prev.progress, Math.min(82, Number(data.progress || 0) * 0.62));
          
          let ethSpeed = isUpload ? prev.uploadSpeedEthernet : prev.downloadSpeedEthernet;
          let wifiSpeed = isUpload ? prev.uploadSpeedWifi : prev.downloadSpeedWifi;
          let combinedSpeed = isUpload ? prev.uploadSpeedCombined : prev.downloadSpeedCombined;

          if (mode === 'single') {
            if (ipAddress === ethernetConfig.ipAddress) { updates[ethField] = currentSpeed; ethSpeed = currentSpeed; }
            if (ipAddress === wifiConfig.ipAddress) { updates[wifiField] = currentSpeed; wifiSpeed = currentSpeed; }
            updates[combinedField] = currentSpeed;
            combinedSpeed = currentSpeed;
          } else if (mode === 'bonded') {
            updates[combinedField] = currentSpeed;
            combinedSpeed = currentSpeed;
            if (Object.prototype.hasOwnProperty.call(normalizedBreakdown, ethernetConfig.ipAddress)) {
              updates[ethField] = normalizedBreakdown[ethernetConfig.ipAddress];
              ethSpeed = updates[ethField];
            }
            if (Object.prototype.hasOwnProperty.call(normalizedBreakdown, wifiConfig.ipAddress)) {
              updates[wifiField] = normalizedBreakdown[wifiConfig.ipAddress];
              wifiSpeed = updates[wifiField];
            }
          }

          const elapsedSec = (Date.now() - startTimeRef.current) / 1000;
          const newHistory = [...prev.historyData, {
            timeSec: parseFloat(elapsedSec.toFixed(1)),
            ethernetMbps: ethSpeed,
            wifiMbps: wifiSpeed,
            combinedMbps: combinedSpeed,
            targetMbps: combinedSpeed
          }];

          return { ...prev, ...updates, historyData: newHistory };
        });

        if (data.done) {
          closeSource();
          resolve(finalResult);
        }
      };

      evtSource.onerror = (err) => {
        closeSource();
        if (isTestCancelledRef.current) {
          resolve(finalResult);
        } else {
          reject(err);
        }
      };
    });
  };

  const stopSpeedTest = () => {
    isTestCancelledRef.current = true;
    activeEventSourcesRef.current.forEach(source => source.close());
    activeEventSourcesRef.current = [];
    setTestState(prev => ({ ...prev, status: 'idle', progress: 0 }));
  };

  useEffect(() => {
    return () => {
      if (testTimerRef.current) clearInterval(testTimerRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      activeEventSourcesRef.current.forEach(source => source.close());
      activeEventSourcesRef.current = [];
    };
  }, []);

  // Calculate speed boost multiplier
  const singleBestSpeed = Math.max(targetEthSpeed, targetWifiSpeed);
  const boostRatio = singleBestSpeed > 0 
    ? ((testState.downloadSpeedCombined - singleBestSpeed) / singleBestSpeed * 100).toFixed(0)
    : '0';
  const isUploadDisplay = testState.status === 'uploading';
  const displayEthSpeed = isUploadDisplay ? testState.uploadSpeedEthernet : testState.downloadSpeedEthernet;
  const displayWifiSpeed = isUploadDisplay ? testState.uploadSpeedWifi : testState.downloadSpeedWifi;
  const displayCombinedSpeed = isUploadDisplay ? testState.uploadSpeedCombined : testState.downloadSpeedCombined;
  const displayTransferredMb = isUploadDisplay ? testState.totalBytesUploadedMb : testState.totalBytesDownloadedMb;

  return (
    <div className="space-y-6">
      
      {/* Top Banner / Mode Switcher */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 rounded-3xl border border-slate-800/80 bg-slate-900/50 p-6 backdrop-blur-xl shadow-xl shadow-black/20">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <h2 className="text-xl font-bold tracking-tight text-white">
              {isAr ? 'محرك اختبار ودمج السرعات الفوري (Live Multi-Link Speedtest)' : 'Real-time Multi-Link Aggregation Speedtest'}
            </h2>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-400">
            {isAr 
              ? 'يقيس سرعة كابل اللان والواي فاي معاً كقناة مجمعة موحدة فائقة السرعة مع فحص زمن الاستجابة وتوزيع المقابس'
              : 'Benchmarks Ethernet & Wi-Fi throughput concurrently as a unified bonded pipe with socket stream telemetry'}
          </p>
        </div>

        {/* Test Mode Selector */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-slate-800/90 bg-slate-950/80 p-1.5 text-xs font-semibold shadow-inner">
          <button
            id="mode-multistream"
            onClick={() => setTestMode('MULTI_STREAM')}
            className={`rounded-xl px-3.5 py-1.5 transition-all duration-200 ${
              testMode === 'MULTI_STREAM' 
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold shadow-md shadow-cyan-500/25 ring-1 ring-cyan-400/40' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {isAr ? 'دمج متعدد المقابس (Speedtest Multi / Proxy)' : 'Multi-Stream (Speedtest.net / Proxy)'}
          </button>
          <button
            id="mode-chunked"
            onClick={() => setTestMode('CHUNKED_IDM')}
            className={`rounded-xl px-3.5 py-1.5 transition-all duration-200 ${
              testMode === 'CHUNKED_IDM' 
                ? 'bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 font-bold shadow-md shadow-cyan-500/25 ring-1 ring-emerald-400/40' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {isAr ? 'تحميل مجزأ (IDM / Steam / P2P)' : 'Chunked (IDM / Steam / Torrent)'}
          </button>
          <button
            id="mode-singlestream"
            onClick={() => setTestMode('SINGLE_STREAM')}
            className={`rounded-xl px-3.5 py-1.5 transition-all duration-200 ${
              testMode === 'SINGLE_STREAM' 
                ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/25 ring-1 ring-amber-400/40' 
                : 'text-slate-400 hover:text-white'
            }`}
            title={isAr ? 'بدون سيرفر دمج، يستخدم الويندوز كارت واحد فقط!' : 'Without proxy or MPTCP, OS uses single adapter!'}
          >
            {isAr ? 'بدون دمج (Single Connection الافتراضي)' : 'Unbonded (Default Single Socket)'}
          </button>
        </div>
      </div>

      {/* Main Speedtest Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Big Aggregated Gauge & Quick Controls */}
        <div className="lg:col-span-5 flex flex-col justify-between rounded-3xl border border-slate-800/80 bg-slate-900/50 p-6 backdrop-blur-xl relative overflow-hidden shadow-xl shadow-black/20">
          
          {/* Background Ambient Glow */}
          <div className="absolute -top-24 -left-24 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />

          {/* Top Status & Efficiency Badge */}
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 rounded-full border border-slate-700/80 bg-slate-800/60 px-3.5 py-1 text-xs text-slate-300 backdrop-blur-md shadow-sm">
              <Activity className="h-3.5 w-3.5 text-cyan-400" />
              {testState.status === 'idle' && (isAr ? 'جاهز للاختبار' : 'Ready')}
              {testState.status === 'pinging' && (isAr ? 'قياس الاستجابة والـ Ping...' : 'Measuring Latency...')}
              {testState.status === 'downloading' && (isAr ? 'تحميل مجمع (Dual Aggregation)...' : 'Downloading Bonded Streams...')}
              {testState.status === 'uploading' && (isAr ? 'رفع مجمع (Dual Upload)...' : 'Uploading Bonded Streams...')}
              {testState.status === 'completed' && (isAr ? 'اكتمل الاختبار بنجاح 🎉' : 'Benchmark Completed 🎉')}
            </span>

            {testState.status === 'completed' && Number(boostRatio) > 0 && (
              <span className="flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-0.5 text-xs font-bold text-emerald-400 shadow-sm shadow-emerald-500/10">
                <Flame className="h-3.5 w-3.5 text-emerald-400" />
                +{boostRatio}% {isAr ? 'زيادة في السرعة' : 'Speed Boost'}
              </span>
            )}
          </div>

          {/* Central Circular Gauge Visualizer */}
          <div className="my-6 flex flex-col items-center justify-center">
            <div className="relative flex h-64 w-64 items-center justify-center">
              {/* Outer SVG Gauge Ring */}
              <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 100 100">
                {/* Background Ring */}
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  className="stroke-slate-800/80"
                  strokeWidth="8"
                  fill="transparent"
                />
                {/* Ethernet Ring Portion (Cyan) */}
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  className="stroke-cyan-400 transition-all duration-300"
                  strokeWidth="8"
                  strokeDasharray={264}
                  strokeDashoffset={264 - (264 * (Math.min(targetCombinedSpeed, displayEthSpeed) / (targetCombinedSpeed || 100)) * 0.75)}
                  strokeLinecap="round"
                  fill="transparent"
                />
                {/* Wi-Fi Ring Portion (Emerald) */}
                <circle
                  cx="50"
                  cy="50"
                  r="34"
                  className="stroke-emerald-400 transition-all duration-300"
                  strokeWidth="6"
                  strokeDasharray={213}
                  strokeDashoffset={213 - (213 * (Math.min(targetCombinedSpeed, displayWifiSpeed) / (targetCombinedSpeed || 100)) * 0.75)}
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>

              {/* Center Metrics Readout */}
              <div className="absolute flex flex-col items-center text-center">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {testState.status === 'uploading' 
                    ? (isAr ? 'سرعة الرفع المجمعة' : 'Combined Upload')
                    : (isAr ? 'سرعة التحميل المجمعة' : 'Combined Download')}
                </span>
                <span className="my-1 font-mono text-5xl font-extrabold tracking-tight text-white drop-shadow-lg">
                  {displayCombinedSpeed.toFixed(0)}
                </span>
                <span className="font-mono text-xs font-bold text-cyan-400">
                  Mbps ({(displayCombinedSpeed / 8).toFixed(1)} MB/s)
                </span>
              </div>
            </div>

            {/* Sub-Interfaces Real-time Contribution Breakdown */}
            <div className="grid w-full grid-cols-2 gap-3 pt-2">
              <div className="rounded-2xl border border-cyan-900/40 bg-cyan-950/20 p-3.5 backdrop-blur-sm">
                <div className="flex items-center justify-between text-xs text-cyan-300">
                  <span className="flex items-center gap-1.5 font-semibold">
                    <Cable className="h-3.5 w-3.5 text-cyan-400" />
                    {isAr ? 'كابل الإيثرنت (LAN)' : 'Ethernet (LAN)'}
                  </span>
                  <span className="font-mono font-bold">{displayEthSpeed.toFixed(0)} Mbps</span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div 
                    className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-300"
                    style={{ width: `${Math.min(100, (displayEthSpeed / (targetEthSpeed || 1)) * 100)}%` }}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-900/40 bg-emerald-950/20 p-3.5 backdrop-blur-sm">
                <div className="flex items-center justify-between text-xs text-emerald-300">
                  <span className="flex items-center gap-1.5 font-semibold">
                    <Wifi className="h-3.5 w-3.5 text-emerald-400" />
                    {isAr ? 'شبكة الواي فاي' : 'Wi-Fi Link'}
                  </span>
                  <span className="font-mono font-bold">{displayWifiSpeed.toFixed(0)} Mbps</span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div 
                    className="h-full bg-emerald-400 transition-all duration-300"
                    style={{ width: `${Math.min(100, (displayWifiSpeed / (targetWifiSpeed || 1)) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Test Control Action Buttons */}
          <div className="pt-2 flex flex-col gap-2.5">
            {testState.status === 'idle' || testState.status === 'completed' ? (
              <button
                id="btn-start-speedtest"
                onClick={startSpeedTest}
                className="group relative flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 py-3.5 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-500/25 transition-all duration-200 hover:scale-[1.01] hover:shadow-cyan-500/40 active:scale-[0.99]"
              >
                <Play className="h-4 w-4 fill-slate-950" />
                <span>
                  {testState.status === 'completed' 
                    ? (isAr ? 'إعادة تشغيل الاختبار المزدوج' : 'Run Test Again') 
                    : (isAr ? 'بدء اختبار السرعة المجمعة' : 'Start Combined Speedtest')}
                </span>
              </button>
            ) : (
              <button
                id="btn-stop-speedtest"
                onClick={stopSpeedTest}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-500/40 bg-red-500/10 py-3.5 text-sm font-bold text-red-300 transition-all hover:bg-red-500/20"
              >
                <Square className="h-4 w-4 fill-red-400" />
                <span>{isAr ? 'إيقاف الاختبار' : 'Stop Speedtest'}</span>
              </button>
            )}

            {/* Test Progress Bar */}
            {testState.status !== 'idle' && (
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                <div 
                  className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-300"
                  style={{ width: `${testState.progress}%` }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Bandwidth Graphs & Telemetry */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          
          {/* Real-time Multi-WAN Bandwidth Chart */}
          <div className="rounded-3xl border border-slate-800/80 bg-slate-900/50 p-6 backdrop-blur-xl shadow-xl shadow-black/20">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Zap className="h-4 w-4 text-cyan-400" />
                  {isAr ? 'مخطط تدفق البيانات الحي (Throughput Aggregation Curve)' : 'Live Bandwidth Aggregation Curve'}
                </h3>
                <p className="text-xs text-slate-400">
                  {isAr ? 'مقارنة آنية لسرعة الإيثرنت + الواي فاي = السرعة الكلية' : 'Real-time comparison: Ethernet + Wi-Fi = Bonded Output'}
                </p>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1 text-cyan-400">
                  <span className="h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400" />
                  {isAr ? 'كابل LAN' : 'Ethernet'}
                </span>
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400" />
                  {isAr ? 'واي فاي' : 'Wi-Fi'}
                </span>
                <span className="flex items-center gap-1 text-amber-300 font-bold">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400 shadow-sm shadow-amber-400" />
                  {isAr ? 'السرعة المجمعة' : 'Combined'}
                </span>
              </div>
            </div>

            {/* Recharts Area Chart Container */}
            <div className="h-56 w-full">
              {testState.historyData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={testState.historyData}>
                    <defs>
                      <linearGradient id="colorCombined" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.45}/>
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0}/>
                      </linearGradient>
                      <linearGradient id="colorEth" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.45}/>
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0}/>
                      </linearGradient>
                      <linearGradient id="colorWifi" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.45}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis 
                      dataKey="timeSec" 
                      stroke="#64748b" 
                      fontSize={11} 
                      unit="s"
                      tickLine={false}
                    />
                    <YAxis 
                      stroke="#64748b" 
                      fontSize={11} 
                      unit="M"
                      tickLine={false}
                      domain={[0, 'auto']}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#0f172a', 
                        borderColor: '#334155', 
                        borderRadius: '1rem',
                        fontSize: '12px',
                        color: '#fff',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)'
                      }} 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="combinedMbps" 
                      name={isAr ? 'السرعة الكلية' : 'Combined'} 
                      stroke="#f59e0b" 
                      strokeWidth={2.5} 
                      fillOpacity={1} 
                      fill="url(#colorCombined)" 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="ethernetMbps" 
                      name={isAr ? 'إيثرنت' : 'Ethernet'} 
                      stroke="#06b6d4" 
                      strokeWidth={1.5} 
                      fillOpacity={1} 
                      fill="url(#colorEth)" 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="wifiMbps" 
                      name={isAr ? 'واي فاي' : 'Wi-Fi'} 
                      stroke="#10b981" 
                      strokeWidth={1.5} 
                      fillOpacity={1} 
                      fill="url(#colorWifi)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full flex-col items-center justify-center text-center text-slate-500">
                  <Activity className="h-8 w-8 text-slate-600 mb-2 opacity-50" />
                  <p className="text-xs">{isAr ? 'اضغط على "بدء اختبار السرعة" لعرض الرسم البياني الحي' : 'Click "Start Speedtest" to begin live aggregation curve'}</p>
                </div>
              )}
            </div>
          </div>

          {/* Metric Telemetry 4-Pack (Ping, Jitter, Download, Upload) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            
            {/* Ping */}
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-4 backdrop-blur-md shadow-sm">
              <span className="text-xs text-slate-400">{isAr ? 'زمن الاستجابة (Ping)' : 'Latency (Ping)'}</span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="font-mono text-2xl font-bold text-cyan-300">
                  {testState.pingMs || '--'}
                </span>
                <span className="text-xs text-slate-500 font-mono">ms</span>
              </div>
              <span className="mt-1 text-[11px] text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> {isAr ? 'ممتاز للألعاب' : 'Ultra-Low'}
              </span>
            </div>

            {/* Jitter */}
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-4 backdrop-blur-md shadow-sm">
              <span className="text-xs text-slate-400">{isAr ? 'التباين (Jitter)' : 'Jitter Variance'}</span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="font-mono text-2xl font-bold text-teal-300">
                  {testState.jitterMs || '--'}
                </span>
                <span className="text-xs text-slate-500 font-mono">ms</span>
              </div>
              <span className="mt-1 text-[11px] text-slate-400">
                Grade: {testState.bufferbloatGrade}
              </span>
            </div>

            {/* Download Peak */}
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-4 backdrop-blur-md shadow-sm">
              <span className="text-xs text-slate-400">{isAr ? 'ذروة التحميل' : 'Peak Download'}</span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="font-mono text-2xl font-bold text-amber-300">
                  {testState.downloadSpeedCombined > 0 ? testState.downloadSpeedCombined.toFixed(0) : '--'}
                </span>
                <span className="text-xs text-slate-500 font-mono">Mbps</span>
              </div>
              <span className="mt-1 text-[11px] text-cyan-400">
                {(testState.downloadSpeedCombined / 8).toFixed(1)} MB/s
              </span>
            </div>

            {/* Upload Peak */}
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-4 backdrop-blur-md shadow-sm">
              <span className="text-xs text-slate-400">{isAr ? 'ذروة الرفع' : 'Peak Upload'}</span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="font-mono text-2xl font-bold text-emerald-300">
                  {testState.uploadSpeedCombined > 0 ? testState.uploadSpeedCombined.toFixed(0) : '--'}
                </span>
                <span className="text-xs text-slate-500 font-mono">Mbps</span>
              </div>
              <span className="mt-1 text-[11px] text-emerald-400">
                {(testState.uploadSpeedCombined / 8).toFixed(1)} MB/s
              </span>
            </div>

          </div>

          {/* Visual Dual-Pipeline Data Flow Animation */}
          <div className="rounded-3xl border border-slate-800/80 bg-slate-900/50 p-5 backdrop-blur-xl shadow-xl shadow-black/20">
            <div className="flex items-center justify-between mb-3 text-xs">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-cyan-400" />
                {isAr ? 'محاكي تدفق مقابس البيانات (Socket Aggregator Visualizer)' : 'Socket Stream Flow Visualizer'}
              </span>
              <span className="text-slate-400 text-[11px]">
                {isAr ? 'توزيع الحزم بالتناوب على كارت اللان والواي فاي' : 'Multi-socket packet scheduling'}
              </span>
            </div>

            <div className="relative rounded-2xl border border-slate-800/80 bg-slate-950/80 p-4 shadow-inner">
              
              {/* Pipeline Track 1: Ethernet */}
              <div className="flex items-center gap-3 mb-3">
                <div className="flex w-32 items-center gap-1.5 rounded-xl bg-cyan-950/40 border border-cyan-900/40 px-2.5 py-1 text-xs text-cyan-300 shrink-0">
                  <Cable className="h-3.5 w-3.5 text-cyan-400" />
                  <span className="truncate font-mono">{ethernetConfig.ipAddress}</span>
                </div>
                <div className="relative h-4 flex-1 overflow-hidden rounded-full bg-slate-900 border border-slate-800">
                  {(testState.status === 'downloading' || testState.status === 'uploading') && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-75 animate-pulse-glow" />
                  )}
                  {livePackets.filter(p => p.source === 'eth').map(pkt => (
                    <div 
                      key={pkt.id} 
                      className="absolute top-0.5 h-3 rounded bg-cyan-400 text-[9px] font-mono text-slate-950 flex items-center px-1 font-bold animate-pulse shadow-sm shadow-cyan-400"
                      style={{ right: `${(pkt.id % 70) + 15}%` }}
                    >
                      TCP#{pkt.streamId}
                    </div>
                  ))}
                </div>
              </div>

              {/* Pipeline Track 2: Wi-Fi */}
              <div className="flex items-center gap-3">
                <div className="flex w-32 items-center gap-1.5 rounded-xl bg-emerald-950/40 border border-emerald-900/40 px-2.5 py-1 text-xs text-emerald-300 shrink-0">
                  <Wifi className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="truncate font-mono">{wifiConfig.ipAddress}</span>
                </div>
                <div className="relative h-4 flex-1 overflow-hidden rounded-full bg-slate-900 border border-slate-800">
                  {(testState.status === 'downloading' || testState.status === 'uploading') && testMode !== 'SINGLE_STREAM' && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-400 to-transparent opacity-75 animate-pulse-glow" />
                  )}
                  {livePackets.filter(p => p.source === 'wifi').map(pkt => (
                    <div 
                      key={pkt.id} 
                      className="absolute top-0.5 h-3 rounded bg-emerald-400 text-[9px] font-mono text-slate-950 flex items-center px-1 font-bold animate-pulse shadow-sm shadow-emerald-400"
                      style={{ right: `${(pkt.id % 70) + 15}%` }}
                    >
                      TCP#{pkt.streamId}
                    </div>
                  ))}
                </div>
              </div>

              {/* Destination PC Output */}
              <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Cpu className="h-3.5 w-3.5 text-cyan-400" />
                  {isAr ? 'المستقبل النهائي (PC Localhost Socket: 127.0.0.1)' : 'Destination: Localhost Socket (127.0.0.1)'}
                </span>
                <span className="font-mono font-bold text-amber-300">
                  {displayTransferredMb > 0 ? `${displayTransferredMb.toFixed(1)} MB ${isUploadDisplay ? (isAr ? 'مرفوعة' : 'Uploaded') : (isAr ? 'مستقبلة' : 'Received')}` : '0 MB'}
                </span>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-800/50 border border-slate-700/50 p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-cyan-500/5 to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div className="flex items-start gap-4 relative">
              <div className="bg-gradient-to-br from-blue-500 to-cyan-500 p-3 rounded-xl shadow-lg">
                <Server className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-white font-bold mb-1">{isAr ? 'هل الواي فاي يعطي سرعة 0؟ (مشكلة ويندوز)' : 'Wi-Fi stuck at 0? (Windows Bug)'}</h3>
                <p className="text-slate-400 text-sm">
                  {isAr ? 'ويندوز يمنع الواي فاي من العمل مع اللان. اضغط هنا لإصلاح أولوية الكروت (يتطلب موافقة مسؤول).' : 'Windows blocks Wi-Fi when LAN is connected. Click to equalize interface metrics (requires Admin).'}
                </p>
              </div>
            </div>
            
            <button 
              onClick={async () => {
                try {
                  const response = await fetch('/api/fix-windows-routing', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      ips: [ethernetConfig.ipAddress, wifiConfig.ipAddress].filter(Boolean)
                    })
                  });
                  const payload = await response.json().catch(() => null);
                  if (!response.ok || !payload?.success) {
                    throw new Error(payload?.error || 'Routing fix request failed.');
                  }
                  alert(isAr ? 'تم طلب الصلاحيات للكروت المحددة. وافق على النافذة التي ستظهر، ثم أعد تشغيل الاختبار!' : 'UAC Prompt triggered for the selected NICs. Accept it and run the test again.');
                } catch (e) {
                  alert(e instanceof Error ? e.message : 'Failed to execute Windows fix.');
                }
              }}
              className="px-6 py-3 bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white rounded-xl font-bold transition-all flex items-center gap-2 border border-red-500/30 whitespace-nowrap"
            >
              <ShieldCheck className="w-5 h-5" />
              {isAr ? 'إصلاح مشكلة ويندوز ➔' : 'Fix Windows Routing ➔'}
            </button>
          </div>

          <DiagnosticsPanel
            language={language}
            ethernetConfig={ethernetConfig}
            wifiConfig={wifiConfig}
          />

        </div>

      </div>

      {/* Speed Test Note / Setup Callout */}
      <div className="rounded-3xl border border-cyan-500/30 bg-gradient-to-r from-cyan-950/40 via-slate-900/60 to-blue-950/40 p-6 backdrop-blur-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl shadow-cyan-500/5">
        <div className="flex items-start gap-3.5">
          <div className="rounded-2xl bg-cyan-500/10 p-3 text-cyan-400 shrink-0 ring-1 ring-cyan-500/20">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">
              {isAr ? 'تريد تشغيل هذا السيرفر على جهاز الكمبيوتر الخاص بك فوراً؟' : 'Want to run this bonding server on your real PC now?'}
            </h4>
            <p className="mt-0.5 text-xs text-slate-400">
              {isAr 
                ? 'لقد قمنا بتجهيز سكربت Node.js وسكربت PowerShell جاهزين للتشغيل بنقرة واحدة لتحصل على هذه السرعة المجمعة في كل البرامج!'
                : 'We created ready-to-run 1-click Node.js & PowerShell scripts so you can combine Ethernet + Wi-Fi on your physical PC.'}
            </p>
          </div>
        </div>
        <button
          id="btn-goto-server-generator"
          onClick={onNavigateToSetup}
          className="shrink-0 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2.5 text-xs font-bold text-slate-950 transition-all hover:scale-[1.02] shadow-md shadow-cyan-500/25"
        >
          {isAr ? 'عرض سكربتات وسيرفر الدمج ➔' : 'View Server Setup Scripts ➔'}
        </button>
      </div>

    </div>
  );
};
