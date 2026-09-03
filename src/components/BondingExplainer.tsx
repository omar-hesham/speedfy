import React, { useState } from 'react';
import { 
  HelpCircle, 
  ChevronDown, 
  ChevronUp, 
  Network, 
  ShieldCheck, 
  Zap, 
  Layers, 
  Flame, 
  Lightbulb, 
  Terminal, 
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { Language } from '../types';

interface BondingExplainerProps {
  language: Language;
  onNavigateToSetup: () => void;
}

export const BondingExplainer: React.FC<BondingExplainerProps> = ({
  language,
  onNavigateToSetup
}) => {
  const isAr = language === 'ar';
  const [openSection, setOpenSection] = useState<number | null>(0);

  const faqItems = [
    {
      title: {
        ar: 'لماذا لا يقوم نظام ويندوز بدمج كابل اللان والواي فاي تلقائياً؟',
        en: 'Why doesn\'t Windows automatically combine Ethernet and Wi-Fi speeds?'
      },
      content: {
        ar: 'نظام التشغيل ويندوز مبرمج افتراضياً على تفضيل أسرع وسيلة اتصال وتجاهل الوسيلة الثانية كاحتياط (Failover). فإذا كان كابل الإيثرنت متصلاً، يمنحه الويندوز قيمة Metric منخفضة (مثل 25) ويجعل الواي فاي في وضع الخمول (Metric 55). بدون سيرفر بروكسي محلي (مثل Node.js Proxy) أو سكربت تعديل الـ Metric، ستمر جميع الاتصالات عبر كارت واحد فقط!',
        en: 'By default, Windows uses Automatic Metric routing which prioritizes the single fastest adapter (usually Ethernet at metric 25) and treats Wi-Fi as a passive backup (metric 55). Without a local multi-NIC proxy server or routing metric tuning, all outbound traffic flows through only one interface.'
      }
    },
    {
      title: {
        ar: 'ما الفرق بين دمج المقابس (Socket Proxy) ودمج الحزم (MPTCP Packet Bonding)؟',
        en: 'What is the difference between Socket-Level Proxy vs True MPTCP Packet Bonding?'
      },
      content: {
        ar: '1. دمج المقابس (سيرفر Node.js / GOST): يوزع طلبات TCP المتعددة (مثل خيوط Speedtest الـ 16، وخيوط IDM الـ 32، وروابط التحميل) بالتناوب بين الكارتين، فيعطيك مجموع السرعتين كاملاً في التصفح والتحميل واختبارات السرعة بدون الحاجة لأي خوادم خارجية.\n\n2. دمج الحزم (MPTCP + VPS): يقوم بتفكيك الحزمة الواحدة في مستوى النواة وتجميعها في سيرفر سحابي خارجي، وهو مفيد إذا كنت تريد دمج السرعة حتى في اختبار Single Connection والألعاب أونلاين.',
        en: '1. Socket-Level Proxy (Node.js / GOST): Splits distinct TCP sockets across both network cards. It gives you 100% combined speed for multi-stream speedtests, IDM (8-32 connections), Steam, Torrents, and web browsing with ZERO server costs.\n\n2. True MPTCP Packet Bonding (OpenMPTCProuter + VPS): Strips and reassembles individual TCP packets at the kernel level via an external VPS, allowing combined bandwidth even for single-socket transfers and UDP gaming.'
      }
    },
    {
      title: {
        ar: 'كيف أضمن ظهور السرعة المجمعة في موقع Speedtest.net؟',
        en: 'How to ensure Speedtest.net shows the full combined speed?'
      },
      content: {
        ar: 'عند فتح موقع Speedtest.net، تأكد من اختيار وضع "Multi" (وهو الوضع الافتراضي في الموقع). يقوم الموقع بفتح من 8 إلى 16 اتصال متزامن، وسيقوم سيرفر البروكسي المحلي بتمرير نصف الاتصالات عبر كابل اللان والنصف الآخر عبر الواي فاي، لتظهر النتيجة مساوية لمجموع الخطين معاً!',
        en: 'When testing on Speedtest.net, ensure "Multi" mode is selected (default). The benchmark opens 8-16 parallel TCP threads. Our local proxy dispatches threads across Ethernet and Wi-Fi simultaneously, displaying the full combined aggregate bandwidth!'
      }
    },
    {
      title: {
        ar: 'نصيحة ذهبية: منع تعارض الراوترات (Subnet Separation)',
        en: 'Golden Rule: Subnet Separation for Multi-WAN'
      },
      content: {
        ar: 'لابد ألا يحمل كلا الراوترين نفس عنوان الـ IP! على سبيل المثال:\n• الراوتر الأول (المتصل باللان): يجب أن يكون 192.168.1.1\n• الراوتر الثاني (المتصل بالواي فاي): يجب أن تغير عنوانه من صفحة إعداداته ليصبح 192.168.2.1 أو 192.168.0.1.\nبهذا يستطيع نظام التشغيل التمييز بين البوابتين وتوجيه البيانات دون أي تشويش.',
        en: 'Never have both routers on the same IP subnet! For example:\n• Router 1 (LAN): 192.168.1.1\n• Router 2 (Wi-Fi): 192.168.2.1 or 192.168.0.1.\nThis enables the OS routing engine to send independent packets out of each interface.'
      }
    }
  ];

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="rounded-3xl border border-slate-800/80 bg-slate-900/50 p-6 backdrop-blur-xl shadow-xl shadow-black/20">
        <div className="flex items-center gap-3.5">
          <div className="rounded-2xl bg-cyan-500/10 p-3.5 text-cyan-400 ring-1 ring-cyan-500/20 shadow-sm">
            <HelpCircle className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white">
              {isAr ? 'دليل وفلسفة دمج سرعات الإنترنت (How Bonding Works)' : 'Deep Dive: How Multi-WAN Bonding Works'}
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-slate-400">
              {isAr 
                ? 'فهم الأسس التقنية لكيفية عمل تجميع السرعات والفرق بين دمج المقابس ودمج الحزم'
                : 'Understand the networking mechanics behind dual-link aggregation, socket scheduling, and MPTCP.'}
            </p>
          </div>
        </div>
      </div>

      {/* Visual Architectural Comparison Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Method 1: Local Multi-Socket Proxy */}
        <div className="rounded-3xl border border-cyan-500/30 bg-slate-900/50 p-6 backdrop-blur-xl space-y-4 shadow-xl shadow-cyan-500/5 ring-1 ring-cyan-500/20">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-bold text-cyan-300 ring-1 ring-cyan-500/20">
              {isAr ? 'الطريقة الموصى بها (Local Multi-NIC Proxy)' : 'Recommended (Zero-Cost Local Proxy)'}
            </span>
            <Zap className="h-5 w-5 text-cyan-400" />
          </div>
          <h3 className="text-base font-bold text-white">
            {isAr ? '1. دمج المقابس المحلي (Local Node.js Proxy)' : '1. Local Node.js Multi-NIC Proxy'}
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            {isAr 
              ? 'سيرفر صغير يعمل على جهازك يربط كل مقبس جديد بعنوان IP مختلف (Socket LocalAddress Binding). يعطي 100% من مجموع السرعتين في التصفح وSpeedtest وتحميل الملفات عبر IDM وSteam والمتصفحات، دون الحاجة لشراء أي سيرفر خارجي.'
              : 'A local daemon on your PC binding outgoing sockets alternatively to Ethernet IP and Wi-Fi IP. Achieves 100% combined speed across multi-stream speedtests, IDM, Steam, Torrents, and web apps with zero cloud fees.'}
          </p>
        </div>

        {/* Method 2: Kernel Level MPTCP */}
        <div className="rounded-3xl border border-emerald-500/30 bg-slate-900/50 p-6 backdrop-blur-xl space-y-4 shadow-xl shadow-emerald-500/5 ring-1 ring-emerald-500/20">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-300 ring-1 ring-emerald-500/20">
              {isAr ? 'الدمج الكامل على مستوى النواة (Kernel MPTCP)' : 'Kernel MPTCP (Speedify / VPS)'}
            </span>
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
          </div>
          <h3 className="text-base font-bold text-white">
            {isAr ? '2. بروتوكول Multipath TCP وسيرفر VPS' : '2. Multipath TCP & VPS Tunnel'}
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            {isAr 
              ? 'يقوم بتفكيك كل حزمة بيانات إلى نصفين وإرسالها عبر الكارتين وإعادة تجميعها في سيرفر سحابي (VPS). يعطي دمجاً بنسبة 100% حتى في اختبارات السرعة ذات الاتصال الواحد (Single-Stream) وكافة برامج الألعاب أونلاين.'
              : 'Splits individual packets at the network layer, sending halves across both interfaces to reassemble on a remote VPS. Delivers 100% bonding even for single-socket UDP games and single-stream benchmarks.'}
          </p>
        </div>

      </div>

      {/* Accordion FAQ Items */}
      <div className="rounded-3xl border border-slate-800/80 bg-slate-900/50 p-6 backdrop-blur-xl space-y-3.5 shadow-xl shadow-black/20">
        <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-400" />
          {isAr ? 'الأسئلة الشائعة والأخطاء التي يجب تجنبها' : 'Frequently Asked Questions & Common Pitfalls'}
        </h3>

        <div className="space-y-3">
          {faqItems.map((item, idx) => {
            const isOpen = openSection === idx;
            return (
              <div 
                key={idx}
                className="rounded-2xl border border-slate-800/80 bg-slate-950/60 overflow-hidden transition-all shadow-sm"
              >
                <button
                  onClick={() => setOpenSection(isOpen ? null : idx)}
                  className="flex w-full items-center justify-between p-4 text-start text-xs font-bold text-slate-200 hover:text-white transition-colors"
                >
                  <span>{item.title[language]}</span>
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4 text-cyan-400 shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                  )}
                </button>

                {isOpen && (
                  <div className="p-4 pt-0 text-xs text-slate-300/90 leading-relaxed border-t border-slate-900/80 whitespace-pre-line bg-slate-950/40">
                    {item.content[language]}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Direct Action */}
      <div className="flex justify-center pt-2">
        <button
          onClick={onNavigateToSetup}
          className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500 px-7 py-3.5 text-sm font-bold text-slate-950 shadow-xl shadow-cyan-500/20 transition-all hover:scale-105"
        >
          <span>{isAr ? 'انتقل إلى مولد السيرفر والسكربتات الآن' : 'Go to Server Setup & Config Generator'}</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

    </div>
  );
};
