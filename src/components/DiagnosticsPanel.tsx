import React, { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, Bug, CheckCircle2, FileText, RefreshCw, Search } from 'lucide-react';
import { Language, NetworkInterfaceConfig } from '../types';

type DiagnosticEvent = {
  id?: number;
  timestamp?: string;
  level?: 'debug' | 'info' | 'warn' | 'error';
  component?: string;
  event?: string;
  message?: string;
  details?: unknown;
  diagnosis?: string;
};

interface DiagnosticsPanelProps {
  language: Language;
  ethernetConfig: NetworkInterfaceConfig;
  wifiConfig: NetworkInterfaceConfig;
}

const levelStyles: Record<string, string> = {
  error: 'border-red-500/40 bg-red-950/30 text-red-200',
  warn: 'border-amber-500/40 bg-amber-950/20 text-amber-200',
  info: 'border-cyan-500/30 bg-slate-950/70 text-slate-200',
  debug: 'border-slate-700 bg-slate-950/50 text-slate-300'
};

const formatTime = (timestamp?: string) => {
  if (!timestamp) return '--:--:--';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toLocaleTimeString([], { hour12: false });
};

const summarizeDetails = (details: unknown) => {
  if (!details) return '';
  try {
    const json = JSON.stringify(details);
    return json.length > 260 ? `${json.slice(0, 260)}…` : json;
  } catch {
    return String(details);
  }
};

export const DiagnosticsPanel: React.FC<DiagnosticsPanelProps> = ({
  language,
  ethernetConfig,
  wifiConfig
}) => {
  const isAr = language === 'ar';
  const [events, setEvents] = useState<DiagnosticEvent[]>([]);
  const [status, setStatus] = useState<'connecting' | 'live' | 'offline'>('connecting');
  const [logFile, setLogFile] = useState<string>('');
  const [actionMessage, setActionMessage] = useState<string>('');

  const selectedIps = useMemo(
    () => [ethernetConfig.ipAddress, wifiConfig.ipAddress].filter(Boolean),
    [ethernetConfig.ipAddress, wifiConfig.ipAddress]
  );

  const latestDiagnosis = useMemo(
    () => [...events].reverse().find(event => event.diagnosis)?.diagnosis,
    [events]
  );

  useEffect(() => {
    let isMounted = true;

    const appendEvent = (event: DiagnosticEvent) => {
      setEvents(prev => [...prev, event].slice(-120));
    };

    fetch('/api/diagnostics/logs?limit=60')
      .then(response => response.json())
      .then(payload => {
        if (!isMounted) return;
        setEvents(payload.events || []);
        setLogFile(payload.currentLogFile || payload.logFile || '');
      })
      .catch(() => {
        if (isMounted) setStatus('offline');
      });

    const source = new EventSource('/api/diagnostics/live');
    source.onopen = () => {
      if (isMounted) setStatus('live');
    };
    source.onmessage = event => {
      if (!isMounted) return;
      try {
        appendEvent(JSON.parse(event.data));
      } catch {
        appendEvent({ level: 'warn', component: 'frontend', event: 'log_parse_failed', message: event.data });
      }
    };
    source.onerror = () => {
      if (isMounted) setStatus('offline');
    };

    return () => {
      isMounted = false;
      source.close();
    };
  }, []);

  const captureSnapshot = async () => {
    setActionMessage(isAr ? 'جاري التقاط لقطة تشخيصية...' : 'Capturing diagnostic snapshot...');
    try {
      const response = await fetch('/api/diagnostics/snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ips: selectedIps })
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Snapshot failed');
      setActionMessage(payload.diagnosis || (isAr ? 'تم التقاط اللقطة.' : 'Snapshot captured.'));
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Snapshot failed');
    }
  };

  const checkFixResult = async () => {
    setActionMessage(isAr ? 'جاري قراءة نتيجة إصلاح ويندوز...' : 'Reading Windows fix result...');
    try {
      const response = await fetch('/api/diagnostics/routing-fix-result');
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || 'No fix result yet');
      const statusText = payload.result?.status || 'unknown';
      setActionMessage(isAr ? `نتيجة إصلاح ويندوز: ${statusText}` : `Windows fix result: ${statusText}`);
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'No fix result yet');
    }
  };

  const latestEvents = [...events].reverse().slice(0, 12);
  const hasWarnings = latestEvents.some(event => event.level === 'warn' || event.level === 'error');

  return (
    <div className="rounded-3xl border border-slate-800/80 bg-slate-900/50 p-5 backdrop-blur-xl shadow-xl shadow-black/20">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className={`rounded-xl p-2 ${hasWarnings ? 'bg-amber-500/10 text-amber-300' : 'bg-cyan-500/10 text-cyan-300'}`}>
              {hasWarnings ? <AlertTriangle className="h-4 w-4" /> : <Bug className="h-4 w-4" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                {isAr ? 'سجل التشخيص الحي للنظام' : 'Live System Diagnostics Log'}
              </h3>
              <p className="text-xs text-slate-400">
                {isAr
                  ? 'يراقب بدء التشغيل، كروت الشبكة، إصلاح ويندوز، واختبارات التحميل/الرفع لتحديد مكان العطل.'
                  : 'Watches startup, NIC routing, Windows fix attempts, download/upload tests, and pinpoints the failing boundary.'}
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
            <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-mono ${status === 'live' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : status === 'connecting' ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300' : 'border-red-500/40 bg-red-500/10 text-red-300'}`}>
              <Activity className="h-3 w-3" />
              {status === 'live' ? (isAr ? 'مباشر' : 'LIVE') : status === 'connecting' ? (isAr ? 'اتصال...' : 'CONNECTING') : (isAr ? 'غير متصل' : 'OFFLINE')}
            </span>
            {logFile && (
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950/60 px-2.5 py-1 font-mono text-slate-400">
                <FileText className="h-3 w-3" />
                {logFile}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={captureSnapshot}
            className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-bold text-cyan-200 transition hover:bg-cyan-500/20"
          >
            <Search className="h-3.5 w-3.5" />
            {isAr ? 'لقطة تشخيصية' : 'Capture Snapshot'}
          </button>
          <button
            onClick={checkFixResult}
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-200 transition hover:bg-emerald-500/20"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {isAr ? 'نتيجة الإصلاح' : 'Check Fix Result'}
          </button>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-950/50 px-3 py-2 text-xs font-bold text-slate-300 transition hover:bg-slate-800"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {isAr ? 'تحديث' : 'Refresh'}
          </button>
        </div>
      </div>

      {(latestDiagnosis || actionMessage) && (
        <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
          <span className="font-bold text-amber-300">{isAr ? 'التشخيص: ' : 'Diagnosis: '}</span>
          {actionMessage || latestDiagnosis}
        </div>
      )}

      <div className="mt-4 max-h-72 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950/70 p-2 font-mono text-[11px] shadow-inner">
        {latestEvents.length === 0 ? (
          <div className="p-4 text-center text-slate-500">
            {isAr ? 'لا توجد أحداث بعد. شغّل اختبار السرعة أو التقط لقطة تشخيصية.' : 'No events yet. Run a speed test or capture a diagnostic snapshot.'}
          </div>
        ) : latestEvents.map((event, index) => (
          <div
            key={`${event.id || index}-${event.timestamp || ''}`}
            className={`mb-2 rounded-xl border p-2 ${levelStyles[event.level || 'info'] || levelStyles.info}`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-500">{formatTime(event.timestamp)}</span>
              <span className="rounded bg-slate-800/80 px-1.5 py-0.5 uppercase text-slate-300">{event.level || 'info'}</span>
              <span className="text-cyan-300">{event.component || 'system'}</span>
              <span className="text-slate-500">/</span>
              <span className="text-slate-300">{event.event || 'event'}</span>
            </div>
            <div className="mt-1 text-slate-100">{event.message}</div>
            {event.diagnosis && <div className="mt-1 text-amber-200">↳ {event.diagnosis}</div>}
            {event.details && <div className="mt-1 truncate text-slate-500">{summarizeDetails(event.details)}</div>}
          </div>
        ))}
      </div>
    </div>
  );
};
