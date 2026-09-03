import React, { useState } from 'react';
import { 
  Calculator, 
  Clock, 
  HardDrive, 
  TrendingUp, 
  Zap, 
  Layers, 
  Film, 
  Gamepad2, 
  DownloadCloud, 
  Sparkles 
} from 'lucide-react';
import { Language } from '../types';

interface BandwidthCalculatorProps {
  language: Language;
  ethSpeed: number;
  wifiSpeed: number;
}

export const BandwidthCalculator: React.FC<BandwidthCalculatorProps> = ({
  language,
  ethSpeed: initialEthSpeed,
  wifiSpeed: initialWifiSpeed
}) => {
  const isAr = language === 'ar';

  const [ethMbps, setEthMbps] = useState<number>(initialEthSpeed || 60);
  const [wifiMbps, setWifiMbps] = useState<number>(initialWifiSpeed || 80);

  const combinedMbps = ethMbps + wifiMbps;
  const ethMBs = ethMbps / 8;
  const wifiMBs = wifiMbps / 8;
  const combinedMBs = combinedMbps / 8;

  // Calculate download times for various file sizes
  const calculateTime = (sizeGb: number, speedMBs: number) => {
    if (speedMBs <= 0) return { hours: 0, minutes: 0, seconds: 0, formatted: '--' };
    const totalSeconds = (sizeGb * 1024) / speedMBs;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);

    if (hours > 0) {
      return { hours, minutes, seconds, formatted: `${hours}h ${minutes}m` };
    }
    if (minutes > 0) {
      return { hours, minutes, seconds, formatted: `${minutes}m ${seconds}s` };
    }
    return { hours, minutes, seconds, formatted: `${seconds}s` };
  };

  const fileWorkloads = [
    { name: isAr ? 'فيلم Full HD (حجم 4 جيجابايت)' : 'Full HD Movie (4 GB)', sizeGb: 4, icon: Film },
    { name: isAr ? 'تحديث لعبة متوسطة (15 جيجابايت)' : 'Mid Game Patch (15 GB)', sizeGb: 15, icon: DownloadCloud },
    { name: isAr ? 'لعبة ضخمة AAA (حجم 60 جيجابايت)' : 'AAA Game (60 GB)', sizeGb: 60, icon: Gamepad2 },
    { name: isAr ? 'نسخة احتياطية / لعبة 4K (120 جيجابايت)' : 'Large 4K Backup (120 GB)', sizeGb: 120, icon: HardDrive }
  ];

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="rounded-3xl border border-slate-800/80 bg-slate-900/50 p-6 backdrop-blur-xl shadow-xl shadow-black/20">
        <div className="flex items-center gap-3.5">
          <div className="rounded-2xl bg-amber-500/10 p-3.5 text-amber-400 ring-1 ring-amber-500/20 shadow-sm">
            <Calculator className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white">
              {isAr ? 'حاسبة توفير الوقت ومضاعفة السرعة (Bonding Speed Estimator)' : 'Bandwidth Aggregation & Time-Saved Calculator'}
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-slate-400">
              {isAr 
                ? 'احسب السرعة الإجمالية الناتجة والوقت الذي ستوفره عند تحميل الألعاب والملفات الضخمة بعد دمج كابل اللان والواي فاي'
                : 'Estimate combined throughput and exact download time saved across major games and large files.'}
            </p>
          </div>
        </div>
      </div>

      {/* Interactive Input Sliders */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Ethernet Input */}
        <div className="rounded-3xl border border-cyan-500/30 bg-cyan-950/20 p-6 backdrop-blur-xl space-y-4 shadow-xl shadow-cyan-500/5">
          <span className="text-xs font-semibold text-cyan-300 block">
            {isAr ? 'سرعة كابل الإيثرنت (LAN)' : 'Ethernet Speed (LAN)'}
          </span>
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-3xl font-extrabold text-white tracking-tight">{ethMbps}</span>
            <span className="text-xs font-mono text-cyan-400 font-semibold">Mbps ({ethMBs.toFixed(1)} MB/s)</span>
          </div>
          <input
            type="range"
            min="5"
            max="300"
            step="5"
            value={ethMbps}
            onChange={(e) => setEthMbps(parseInt(e.target.value, 10))}
            className="w-full accent-cyan-400 cursor-pointer"
          />
        </div>

        {/* Wi-Fi Input */}
        <div className="rounded-3xl border border-emerald-500/30 bg-emerald-950/20 p-6 backdrop-blur-xl space-y-4 shadow-xl shadow-emerald-500/5">
          <span className="text-xs font-semibold text-emerald-300 block">
            {isAr ? 'سرعة شبكة الواي فاي (Wi-Fi)' : 'Wi-Fi Speed'}
          </span>
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-3xl font-extrabold text-white tracking-tight">{wifiMbps}</span>
            <span className="text-xs font-mono text-emerald-400 font-semibold">Mbps ({wifiMBs.toFixed(1)} MB/s)</span>
          </div>
          <input
            type="range"
            min="5"
            max="300"
            step="5"
            value={wifiMbps}
            onChange={(e) => setWifiMbps(parseInt(e.target.value, 10))}
            className="w-full accent-emerald-400 cursor-pointer"
          />
        </div>

        {/* Combined Output Total */}
        <div className="rounded-3xl border border-amber-500/40 bg-gradient-to-br from-amber-950/30 to-amber-900/10 p-6 backdrop-blur-xl space-y-4 relative overflow-hidden shadow-xl shadow-amber-500/5">
          <div className="absolute top-0 right-0 h-24 w-24 bg-amber-400/15 blur-2xl pointer-events-none" />
          <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
            <Zap className="h-4 w-4 text-amber-400" />
            {isAr ? 'السرعة المجمعة الإجمالية' : 'Total Bonded Output'}
          </span>
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-4xl font-black text-amber-300 tracking-tight">{combinedMbps}</span>
            <span className="text-xs font-mono text-amber-200 font-semibold">Mbps ({combinedMBs.toFixed(1)} MB/s)</span>
          </div>
          <div className="text-xs font-medium text-amber-200/90 bg-amber-500/10 rounded-xl p-2.5 border border-amber-500/20">
            {isAr 
              ? `🚀 أسرع بمقدار +${((combinedMbps / Math.max(ethMbps, wifiMbps) - 1) * 100).toFixed(0)}% من الخط الفردي!`
              : `🚀 +${((combinedMbps / Math.max(ethMbps, wifiMbps) - 1) * 100).toFixed(0)}% faster than single connection!`}
          </div>
        </div>

      </div>

      {/* Download Time Comparison Table */}
      <div className="rounded-3xl border border-slate-800/80 bg-slate-900/50 p-6 backdrop-blur-xl space-y-4 shadow-xl shadow-black/20">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Clock className="h-4 w-4 text-cyan-400" />
          {isAr ? 'مقارنة أوقات التحميل: خط منفرد مقابل السرعة المجمعة' : 'Download Time Breakdown: Single vs Bonded Pipe'}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {fileWorkloads.map((item, idx) => {
            const Icon = item.icon;
            const singleTime = calculateTime(item.sizeGb, Math.max(ethMBs, wifiMBs));
            const bondedTime = calculateTime(item.sizeGb, combinedMBs);

            return (
              <div key={idx} className="rounded-2xl border border-slate-800/80 bg-slate-950/70 p-5 space-y-3.5 shadow-md">
                <div className="flex items-center gap-2.5 text-slate-300">
                  <div className="rounded-xl bg-cyan-500/10 p-2 text-cyan-400">
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-bold truncate text-white">{item.name}</span>
                </div>

                <div className="space-y-2 text-xs pt-2 border-t border-slate-800/80">
                  <div className="flex justify-between text-slate-400">
                    <span>{isAr ? 'قبل الدمج (خط واحد):' : 'Before (Single):'}</span>
                    <span className="font-mono font-medium text-slate-300">{singleTime.formatted}</span>
                  </div>
                  <div className="flex justify-between font-bold text-amber-300">
                    <span>{isAr ? 'بعد دمج السرعتين:' : 'With BondLink:'}</span>
                    <span className="font-mono text-emerald-400 font-bold">{bondedTime.formatted}</span>
                  </div>
                </div>

                <div className="rounded-xl bg-emerald-950/40 border border-emerald-500/20 p-2.5 text-center text-[11px] font-bold text-emerald-300">
                  {isAr ? '⚡ توفير في الوقت بنسبة 50% تقريباً' : '⚡ ~50% faster download time'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};
