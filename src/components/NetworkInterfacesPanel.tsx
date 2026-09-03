import React, { useState, useEffect } from 'react';
import { 
  Cable, 
  Wifi, 
  AlertTriangle, 
  CheckCircle2, 
  Sliders, 
  ShieldAlert, 
  RefreshCw, 
  Activity, 
  Power,
  Play
} from 'lucide-react';
import { Language, NetworkInterfaceConfig } from '../types';

interface NetworkInterfacesPanelProps {
  language: Language;
}

export const NetworkInterfacesPanel: React.FC<NetworkInterfacesPanelProps> = ({
  language,
}) => {
  const isAr = language === 'ar';
  const [isLoading, setIsLoading] = useState(false);
  const [proxyRunning, setProxyRunning] = useState(false);
  const [interfaces, setInterfaces] = useState<NetworkInterfaceConfig[]>([]);

  const fetchRealInterfaces = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/interfaces');
      if (res.ok) {
        const data = await res.json();
        const formatted: NetworkInterfaceConfig[] = data.map((i: any, index: number) => ({
          id: i.id || `nic-${index}`,
          name: i.name,
          type: i.type,
          ipAddress: i.ipAddress,
          macAddress: i.macAddress,
          gateway: i.gateway || 'Auto',
          subnetMask: '255.255.255.0',
          metric: 15,
          nominalSpeedMbps: i.type === 'ethernet' ? 100 : 50,
          currentSpeedMbps: 0,
          latencyMs: i.type === 'ethernet' ? 5 : 20,
          jitterMs: 2,
          packetLossPercent: 0,
          isActive: true, // Default all found to true
          wifiSsid: i.type === 'wifi' ? i.name : undefined,
          wifiSignalDbm: i.type === 'wifi' ? -50 : undefined,
          wifiFrequency: '5.0 GHz'
        }));
        setInterfaces(formatted);
      }
    } catch (e) {
      console.error(e);
    }
    setIsLoading(false);
  };

  // Load initially
  useEffect(() => {
    fetchRealInterfaces();
  }, []);

  const toggleInterface = (index: number) => {
    const newIfaces = [...interfaces];
    newIfaces[index].isActive = !newIfaces[index].isActive;
    setInterfaces(newIfaces);
  };

  const updateInterface = (index: number, key: keyof NetworkInterfaceConfig, value: any) => {
    const newIfaces = [...interfaces];
    (newIfaces[index] as any)[key] = value;
    setInterfaces(newIfaces);
  };

  const startBondingProxy = async () => {
    const activeIps = interfaces.filter(i => i.isActive).map(i => i.ipAddress);

    try {
      const res = await fetch('/api/bond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ips: activeIps })
      });
      if (res.ok) {
        setProxyRunning(true);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="rounded-3xl border border-slate-800/80 bg-slate-900/50 p-6 backdrop-blur-xl shadow-xl shadow-black/20">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="rounded-2xl bg-cyan-500/10 p-3.5 text-cyan-400 ring-1 ring-cyan-500/20 shadow-sm">
              <Sliders className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white">
                {isAr ? 'إدارة كل كروت الشبكة (Multi-NIC Manager)' : 'Multi-NIC Interface Manager'}
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-slate-400">
                {isAr 
                  ? 'تم اكتشاف جميع الكروت (LAN / Wi-Fi) المتصلة بجهازك.'
                  : `Discovered ${interfaces.length} network interfaces on your local machine.`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <button
              onClick={fetchRealInterfaces}
              disabled={isLoading}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 rounded-2xl bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-700 transition-all shadow-md shadow-black/20 ring-1 ring-slate-700"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
              {isAr ? 'تحديث الكروت' : 'Refresh NICs'}
            </button>
            <button
              onClick={startBondingProxy}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold text-slate-950 transition-all shadow-md ${proxyRunning ? 'bg-emerald-500 hover:bg-emerald-400 shadow-emerald-500/20' : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:scale-105 shadow-cyan-500/20'}`}
            >
              {proxyRunning ? <CheckCircle2 className="h-4 w-4" /> : <Play className="h-4 w-4 fill-slate-950" />}
              {proxyRunning ? (isAr ? 'البروكسي يعمل على 8888' : 'Proxy Live on :8888') : (isAr ? 'تشغيل دمج الكل' : 'Start Bonding Proxy')}
            </button>
          </div>
        </div>
      </div>

      {interfaces.length === 0 && !isLoading && (
        <div className="text-center py-12 bg-slate-900/40 rounded-3xl border border-slate-800/80 text-slate-400 text-sm">
          {isAr ? 'جاري البحث عن كروت الشبكة...' : 'No network interfaces found. Click Refresh.'}
        </div>
      )}

      {/* Dynamic Interface Configuration Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {interfaces.map((iface, idx) => {
          const isEth = iface.type === 'ethernet';
          const activeStyle = isEth
            ? 'border-cyan-500/40 bg-slate-900/60 shadow-cyan-500/5 ring-cyan-500/20'
            : 'border-emerald-500/40 bg-slate-900/60 shadow-emerald-500/5 ring-emerald-500/20';
            
          return (
            <div key={iface.ipAddress + idx} className={`rounded-3xl border transition-all duration-300 backdrop-blur-xl ${
              iface.isActive 
                ? `${activeStyle} shadow-xl ring-1` 
                : 'border-slate-800/80 bg-slate-950/40 opacity-60'
            } p-6 space-y-5`}>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`rounded-2xl p-3 ring-1 ${isEth ? 'bg-cyan-500/10 text-cyan-400 ring-cyan-500/20' : 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20'}`}>
                    {isEth ? <Cable className="h-5 w-5" /> : <Wifi className="h-5 w-5" />}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      {iface.name}
                    </h3>
                    <span className={`text-[11px] font-mono ${isEth ? 'text-cyan-400' : 'text-emerald-400'}`}>
                      {isEth ? (isAr ? 'إيثرنت / سلكي' : 'Ethernet Link') : (isAr ? 'لاسلكي / واي فاي' : 'Wireless Link')}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => toggleInterface(idx)}
                  className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                    iface.isActive 
                      ? (isEth ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-cyan-500/20' : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 shadow-emerald-500/20')
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  <Power className="h-3 w-3" />
                  <span>{iface.isActive ? (isAr ? 'مفعل' : 'Active') : (isAr ? 'معطل' : 'Disabled')}</span>
                </button>
              </div>

              <div className="space-y-3.5 pt-2">
                <div>
                  <label className="text-xs text-slate-400 block mb-1 font-medium">{isAr ? 'عنوان IP المحلي' : 'Local IPv4'}</label>
                  <input
                    type="text"
                    readOnly
                    value={iface.ipAddress}
                    className={`w-full rounded-2xl border border-slate-700/80 bg-slate-950/80 px-3.5 py-2.5 font-mono text-xs focus:outline-none shadow-inner ${isEth ? 'text-cyan-300' : 'text-emerald-300'}`}
                  />
                </div>

                {/* Speed Slider */}
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-slate-400 font-medium">{isAr ? 'سرعة الخط الأساسي' : 'Nominal Speed'}</span>
                    <span className={`font-mono font-bold ${isEth ? 'text-cyan-400' : 'text-emerald-400'}`}>{iface.nominalSpeedMbps} Mbps</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="1000"
                    step="10"
                    value={iface.nominalSpeedMbps}
                    onChange={(e) => updateInterface(idx, 'nominalSpeedMbps', parseInt(e.target.value, 10))}
                    className={`w-full cursor-pointer ${isEth ? 'accent-cyan-400' : 'accent-emerald-400'}`}
                  />
                </div>
              </div>

              <div className="rounded-2xl bg-slate-950/60 p-3.5 border border-slate-800/80 flex justify-between text-xs font-mono text-slate-400 shadow-inner">
                <span>MAC: {iface.macAddress}</span>
                <span className={`${isEth ? 'text-cyan-400' : 'text-emerald-400'} font-bold`}>IP: {iface.ipAddress}</span>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};
