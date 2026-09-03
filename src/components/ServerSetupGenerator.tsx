import React, { useState } from 'react';
import { 
  Terminal, 
  Copy, 
  Check, 
  Download, 
  Play, 
  Sliders, 
  FileCode, 
  Layers, 
  CheckCircle2, 
  AlertTriangle, 
  HelpCircle, 
  Sparkles,
  Server,
  Cable,
  Wifi,
  ExternalLink
} from 'lucide-react';
import { SERVER_TEMPLATES } from '../data/serverTemplates';
import { BondingMode, Language, NetworkInterfaceConfig } from '../types';

interface ServerSetupGeneratorProps {
  language: Language;
  ethernetConfig: NetworkInterfaceConfig;
  wifiConfig: NetworkInterfaceConfig;
}

export const ServerSetupGenerator: React.FC<ServerSetupGeneratorProps> = ({
  language,
  ethernetConfig,
  wifiConfig
}) => {
  const isAr = language === 'ar';

  const [selectedMode, setSelectedMode] = useState<BondingMode>('NODE_PROXY');
  const [copied, setCopied] = useState(false);
  const [proxyPort, setProxyPort] = useState<number>(8888);
  const [customEthIp, setCustomEthIp] = useState<string>(ethernetConfig.ipAddress || '192.168.1.100');
  const [customWifiIp, setCustomWifiIp] = useState<string>(wifiConfig.ipAddress || '192.168.2.100');
  const [weightRatio, setWeightRatio] = useState<number>(50); // 50% Ethernet / 50% Wi-Fi

  // Test simulation state
  const [simulatedLogs, setSimulatedLogs] = useState<Array<{ id: number; text: string; type: 'info' | 'eth' | 'wifi' | 'success' }>>([
    { id: 1, text: isAr ? '[Server] السيرفر جاهز للعمل على 127.0.0.1:8888' : '[Server] Ready on 127.0.0.1:8888', type: 'info' }
  ]);
  const [isSimulatingRequest, setIsSimulatingRequest] = useState(false);

  const activeTemplate = SERVER_TEMPLATES[selectedMode];
  const generatedCode = activeTemplate.generateCode(
    customEthIp, 
    customWifiIp, 
    8080, 
    8081, 
    proxyPort, 
    weightRatio
  );

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadFile = () => {
    const blob = new Blob([generatedCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = activeTemplate.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSimulateRequest = () => {
    setIsSimulatingRequest(true);
    const useEth = Math.random() * 100 < weightRatio;
    const targetUrl = ['speedtest.net/api/upload', 'fast.com/speedtest', 'steam.cdn.download/chunk942', 'youtube.com/videoplayback'][Math.floor(Math.random() * 4)];
    
    setTimeout(() => {
      const newLog = useEth ? {
        id: Date.now(),
        text: isAr 
          ? `[CONNECT] ${targetUrl} ➔ تم التوجيه عبر كابل الإيثرنت (${customEthIp}) ⚡`
          : `[CONNECT] ${targetUrl} ➔ Routed via Ethernet (${customEthIp}) ⚡`,
        type: 'eth' as const
      } : {
        id: Date.now(),
        text: isAr 
          ? `[CONNECT] ${targetUrl} ➔ تم التوجيه عبر الواي فاي (${customWifiIp}) 📶`
          : `[CONNECT] ${targetUrl} ➔ Routed via Wi-Fi (${customWifiIp}) 📶`,
        type: 'wifi' as const
      };

      setSimulatedLogs(prev => [newLog, ...prev.slice(0, 7)]);
      setIsSimulatingRequest(false);
    }, 400);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="rounded-3xl border border-slate-800/80 bg-slate-900/50 p-6 backdrop-blur-xl shadow-xl shadow-black/20">
        <div className="flex items-center gap-3.5">
          <div className="rounded-2xl bg-cyan-500/10 p-3.5 text-cyan-400 ring-1 ring-cyan-500/20 shadow-sm">
            <Server className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white">
              {isAr ? 'مولد السيرفر المحلي وسكربتات دمج الشبكات' : 'Local Server & Multi-WAN Config Generator'}
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-slate-400">
              {isAr 
                ? 'اختر طريقة الدمج المناسبة لجهازك، وقم بتخصيص عناوين الـ IP ثم حمل السكربت لتشغيله بنقرة واحدة على حاسوبك!'
                : 'Select your preferred aggregation method, customize adapter IPs, and download the ready-to-run script.'}
            </p>
          </div>
        </div>
      </div>

      {/* Mode Selector Tabs (4 Methods) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {(Object.keys(SERVER_TEMPLATES) as BondingMode[]).map((modeKey) => {
          const tmpl = SERVER_TEMPLATES[modeKey];
          const isSelected = selectedMode === modeKey;
          return (
            <button
              key={modeKey}
              id={`select-mode-${modeKey}`}
              onClick={() => setSelectedMode(modeKey)}
              className={`flex flex-col text-start justify-between rounded-3xl border p-5 transition-all duration-200 backdrop-blur-xl ${
                isSelected
                  ? 'border-cyan-500 bg-cyan-950/40 shadow-xl shadow-cyan-500/15 ring-1 ring-cyan-500/60'
                  : 'border-slate-800/80 bg-slate-900/50 hover:border-slate-700 hover:bg-slate-900/80'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <span className="rounded-full bg-cyan-500/10 px-3 py-0.5 text-[11px] font-bold text-cyan-300 ring-1 ring-cyan-500/20">
                    {tmpl.badge[language]}
                  </span>
                  {isSelected && <CheckCircle2 className="h-4 w-4 text-cyan-400" />}
                </div>
                <h3 className="text-sm font-bold text-white line-clamp-2">
                  {tmpl.name[language]}
                </h3>
                <p className="mt-1.5 text-xs text-slate-400 line-clamp-3 leading-relaxed">
                  {tmpl.tagline[language]}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                <span>{isAr ? 'الملف الناتج:' : 'Output:'}</span>
                <span className="font-mono text-cyan-400 font-bold">{tmpl.filename}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Configuration & Code Output Box */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Interactive Parameters & Instructions */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* IP & Port Settings Card */}
          <div className="rounded-3xl border border-slate-800/80 bg-slate-900/50 p-6 backdrop-blur-xl space-y-4 shadow-xl shadow-black/20">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sliders className="h-4 w-4 text-cyan-400" />
              {isAr ? 'تخصيص عناوين كروت الشبكة والمنفذ' : 'Adapter IP & Port Customization'}
            </h3>

            {/* Ethernet IP Input */}
            <div>
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-1.5">
                <Cable className="h-3.5 w-3.5 text-cyan-400" />
                {isAr ? 'عنوان IP كابل الإيثرنت (LAN IP)' : 'Ethernet Adapter IP (LAN)'}
              </label>
              <input
                type="text"
                id="input-eth-ip"
                value={customEthIp}
                onChange={(e) => setCustomEthIp(e.target.value)}
                className="w-full rounded-2xl border border-slate-700/80 bg-slate-950/80 px-3.5 py-2.5 font-mono text-xs text-white focus:border-cyan-500 focus:outline-none shadow-inner"
                placeholder="192.168.1.100"
              />
            </div>

            {/* Wi-Fi IP Input */}
            <div>
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-1.5">
                <Wifi className="h-3.5 w-3.5 text-emerald-400" />
                {isAr ? 'عنوان IP شبكة الواي فاي (Wi-Fi IP)' : 'Wi-Fi Adapter IP'}
              </label>
              <input
                type="text"
                id="input-wifi-ip"
                value={customWifiIp}
                onChange={(e) => setCustomWifiIp(e.target.value)}
                className="w-full rounded-2xl border border-slate-700/80 bg-slate-950/80 px-3.5 py-2.5 font-mono text-xs text-white focus:border-cyan-500 focus:outline-none shadow-inner"
                placeholder="192.168.2.100"
              />
            </div>

            {/* Proxy Port & Weight Slider (for Node.js) */}
            {selectedMode === 'NODE_PROXY' && (
              <>
                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1.5 block">
                    {isAr ? 'منفذ البروكسي المحلي (Listen Port)' : 'Local Proxy Listen Port'}
                  </label>
                  <input
                    type="number"
                    id="input-proxy-port"
                    value={proxyPort}
                    onChange={(e) => setProxyPort(parseInt(e.target.value, 10) || 8888)}
                    className="w-full rounded-2xl border border-slate-700/80 bg-slate-950/80 px-3.5 py-2.5 font-mono text-xs text-white focus:border-cyan-500 focus:outline-none shadow-inner"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-slate-300 font-medium">{isAr ? 'نسبة توزيع الترافيك (Traffic Weight)' : 'Traffic Ratio'}</span>
                    <span className="font-mono text-cyan-400 font-bold">{weightRatio}% LAN / {100 - weightRatio}% Wi-Fi</span>
                  </div>
                  <input
                    type="range"
                    id="input-weight-ratio"
                    min="10"
                    max="90"
                    value={weightRatio}
                    onChange={(e) => setWeightRatio(parseInt(e.target.value, 10))}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                </div>
              </>
            )}

            {/* Note on Subnet separation */}
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3.5 text-xs text-amber-300/90 flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
              <p className="leading-relaxed">
                {isAr 
                  ? 'تنبيه هام: يجب أن يكون لكل راوتر نطاق IP مختلف (مثال: راوتر اللان 192.168.1.x وراوتر الواي فاي 192.168.2.x) لكي يستطيع نظام التشغيل التوجيه بشكل متزامن.'
                  : 'Important: Both routers should use different subnets (e.g. LAN on 192.168.1.x and Wi-Fi on 192.168.2.x) to route concurrently.'}
              </p>
            </div>
          </div>

          {/* Step-by-Step Instructions Card */}
          <div className="rounded-3xl border border-slate-800/80 bg-slate-900/50 p-6 backdrop-blur-xl shadow-xl shadow-black/20">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              {isAr ? 'خطوات التشغيل والتفعيل على جهازك' : 'Step-by-Step Execution Guide'}
            </h3>
            <ol className="space-y-2.5 text-xs text-slate-300 list-decimal list-inside">
              {activeTemplate.instructions[language].map((step, idx) => (
                <li key={idx} className="leading-relaxed bg-slate-950/60 p-3 rounded-2xl border border-slate-800/70">
                  <span className="font-medium text-slate-200">{step}</span>
                </li>
              ))}
            </ol>
          </div>

        </div>

        {/* Right Column: Code Viewer & Interactive Live Simulation Terminal */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          
          {/* Code Viewer Box */}
          <div className="rounded-3xl border border-slate-800/80 bg-slate-950/90 overflow-hidden flex flex-col shadow-xl shadow-black/20">
            
            {/* Header with Filename & Actions */}
            <div className="flex items-center justify-between border-b border-slate-800/80 bg-slate-900/80 px-5 py-3.5 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <FileCode className="h-4 w-4 text-cyan-400" />
                <span className="font-mono text-xs font-bold text-slate-200">
                  {activeTemplate.filename}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  id="btn-copy-code"
                  onClick={handleCopyCode}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-700/80 bg-slate-800/80 px-3.5 py-1.5 text-xs font-semibold text-slate-200 transition-all hover:bg-slate-700 hover:text-white shadow-sm"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      <span className="text-emerald-400">{isAr ? 'تم النسخ!' : 'Copied!'}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 text-slate-400" />
                      <span>{isAr ? 'نسخ الكود' : 'Copy Code'}</span>
                    </>
                  )}
                </button>

                <button
                  id="btn-download-script"
                  onClick={handleDownloadFile}
                  className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-3.5 py-1.5 text-xs font-bold text-slate-950 transition-all hover:scale-[1.02] shadow-md shadow-cyan-500/25"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>{isAr ? 'تحميل الملف' : 'Download Script'}</span>
                </button>
              </div>
            </div>

            {/* Syntax Code Body */}
            <div className="max-h-96 overflow-y-auto p-5 font-mono text-xs text-cyan-300/90 leading-relaxed bg-slate-950/90">
              <pre className="whitespace-pre-wrap">{generatedCode}</pre>
            </div>
          </div>

          {/* Interactive Socket Dispatch Terminal Simulator */}
          <div className="rounded-3xl border border-slate-800/80 bg-slate-900/50 p-6 backdrop-blur-xl shadow-xl shadow-black/20">
            <div className="flex items-center justify-between mb-3.5">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-emerald-400" />
                  {isAr ? 'محاكي استقبال الطلبات وتوزيع المقابس (Live Socket Dispatch Simulator)' : 'Live Request Dispatch Simulator'}
                </h3>
                <p className="text-xs text-slate-400">
                  {isAr ? 'اضغط لتجربة كيف يقوم السيرفر بتحويل الطلبات بين الإيثرنت والواي فاي' : 'Simulate incoming TCP traffic routing across both NICs'}
                </p>
              </div>

              <button
                id="btn-simulate-request"
                onClick={handleSimulateRequest}
                disabled={isSimulatingRequest}
                className="flex items-center gap-1.5 rounded-xl bg-slate-800/90 border border-slate-700/80 px-3.5 py-1.5 text-xs font-bold text-emerald-400 hover:bg-slate-700 transition-all disabled:opacity-50 shadow-sm"
              >
                <Play className="h-3 w-3 fill-emerald-400" />
                <span>{isAr ? 'إرسال طلب تجريبي' : 'Dispatch Test Request'}</span>
              </button>
            </div>

            {/* Console Log Output */}
            <div className="rounded-2xl border border-slate-800/80 bg-slate-950/90 p-3.5 font-mono text-xs space-y-1.5 max-h-40 overflow-y-auto shadow-inner">
              {simulatedLogs.map((log) => (
                <div key={log.id} className="flex items-center gap-2">
                  <span className="text-slate-600">❯</span>
                  <span className={
                    log.type === 'eth' ? 'text-cyan-400' :
                    log.type === 'wifi' ? 'text-emerald-400' :
                    'text-slate-300'
                  }>
                    {log.text}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
