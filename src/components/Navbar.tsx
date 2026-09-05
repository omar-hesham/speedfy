import React from 'react';
import { 
  Network, 
  Gauge, 
  Terminal, 
  Sliders, 
  Calculator, 
  HelpCircle, 
  Wifi, 
  Cable, 
  Zap, 
  Languages 
} from 'lucide-react';
import { Language } from '../types';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  isEthActive: boolean;
  isWifiActive: boolean;
  combinedSpeed: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  language,
  setLanguage,
  isEthActive,
  isWifiActive,
  combinedSpeed
}) => {
  const isAr = language === 'ar';

  const navItems = [
    {
      id: 'dashboard',
      label: isAr ? 'لوحة التحكم' : 'Dashboard',
      icon: LayoutDashboard,
      highlight: true
    },
    {
      id: 'speedtest',
      label: isAr ? 'اختبار السرعة المجمعة' : 'Combined Speedtest',
      icon: Gauge
    },
    {
      id: 'server-setup',
      label: isAr ? 'سيرفر الدمج والسكربتات' : 'Local Server & Config',
      icon: Terminal,
      highlight: true
    },
    {
      id: 'interfaces',
      label: isAr ? 'إدارة الكروت والشبكات' : 'Interface Manager',
      icon: Sliders
    },
    {
      id: 'calculator',
      label: isAr ? 'حاسبة السرعة' : 'Speed Calculator',
      icon: Calculator
    },
    {
      id: 'explainer',
      label: isAr ? 'كيف يعمل الدمج؟' : 'How Bonding Works',
      icon: HelpCircle
    },
    {
      id: 'bonding-status',
      label: isAr ? 'حالة الدمج الأصلي' : 'Native Bonding',
      icon: Zap,
      highlight: true
    }
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800/70 bg-[#030712]/80 backdrop-blur-xl transition-all">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/25 ring-1 ring-white/20">
              <Zap className="h-5 w-5 text-slate-950 font-bold" />
              <div className="absolute inset-0 rounded-xl bg-cyan-400 opacity-20 blur-sm pointer-events-none" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold tracking-tight text-white font-mono">
                  Bond<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">Link</span>
                </span>
                <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-300 shadow-sm shadow-cyan-500/10">
                  v2.5 Dual-NIC
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                {isAr ? 'منظومة دمج سرعة كابل الإيثرنت والواي فاي' : 'Ethernet + Wi-Fi Bandwidth Aggregator'}
              </p>
            </div>
          </div>

          {/* Center Tabs for Desktop */}
          <nav className="hidden md:flex items-center gap-1 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-1 backdrop-blur-md shadow-inner">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-tab-${item.id}`}
                  onClick={() => setCurrentTab(item.id)}
                  className={`relative flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold shadow-md shadow-cyan-500/25 ring-1 ring-cyan-400/40'
                      : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Status & Controls */}
          <div className="flex items-center gap-3">
            {/* Live Dual-Link Status Indicator */}
            <div className="hidden lg:flex items-center gap-2.5 rounded-xl border border-slate-800/80 bg-slate-900/70 px-3 py-1.5 text-xs shadow-sm">
              <div className="flex items-center gap-1.5 text-slate-300">
                <span className={`h-2 w-2 rounded-full ${isEthActive ? 'bg-cyan-400 shadow-sm shadow-cyan-400' : 'bg-slate-600'}`} />
                <Cable className={`h-3.5 w-3.5 ${isEthActive ? 'text-cyan-400' : 'text-slate-600'}`} />
                <span className={`text-[11px] font-mono ${isEthActive ? 'text-cyan-300 font-medium' : 'text-slate-500'}`}>LAN</span>
              </div>
              <span className="text-slate-700 font-bold">+</span>
              <div className="flex items-center gap-1.5 text-slate-300">
                <span className={`h-2 w-2 rounded-full ${isWifiActive ? 'bg-emerald-400 shadow-sm shadow-emerald-400' : 'bg-slate-600'}`} />
                <Wifi className={`h-3.5 w-3.5 ${isWifiActive ? 'text-emerald-400' : 'text-slate-600'}`} />
                <span className={`text-[11px] font-mono ${isWifiActive ? 'text-emerald-300 font-medium' : 'text-slate-500'}`}>Wi-Fi</span>
              </div>
              <span className="text-slate-700 font-bold">=</span>
              <span className="font-mono font-bold text-amber-300 text-xs">
                {combinedSpeed > 0 ? `${combinedSpeed.toFixed(0)} Mbps` : (isAr ? 'جاهز' : 'Ready')}
              </span>
            </div>

            {/* Language Switcher */}
            <button
              id="lang-toggle-btn"
              onClick={() => setLanguage(isAr ? 'en' : 'ar')}
              className="flex items-center gap-1.5 rounded-xl border border-slate-800/80 bg-slate-900/80 px-3 py-1.5 text-xs font-semibold text-slate-300 transition-all hover:border-slate-700 hover:bg-slate-800 hover:text-white shadow-sm"
              title={isAr ? 'Switch to English' : 'التبديل إلى العربية'}
            >
              <Languages className="h-3.5 w-3.5 text-cyan-400" />
              <span>{isAr ? 'EN' : 'عربي'}</span>
            </button>
          </div>
        </div>

        {/* Mobile Sub-Navigation Bar */}
        <div className="flex md:hidden overflow-x-auto py-2 gap-1.5 border-t border-slate-800/60 no-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                id={`mobile-nav-${item.id}`}
                onClick={() => setCurrentTab(item.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                    : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-200'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
