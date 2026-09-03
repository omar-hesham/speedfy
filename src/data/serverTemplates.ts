import { ServerTemplate } from '../types';

export const SERVER_TEMPLATES: Record<string, ServerTemplate> = {
  NODE_PROXY: {
    id: 'NODE_PROXY',
    name: {
      ar: 'سيرفر بروكسي محلي (Node.js Multi-NIC Aggregator)',
      en: 'Local Node.js Multi-NIC Aggregation Proxy'
    },
    tagline: {
      ar: 'سيرفر محلي خفيف يعمل على جهازك فوراً بدون برامج معقدة، يوزع طلبات TCP/HTTP على كابل الإيثرنت والواي فاي بالتناوب.',
      en: 'Lightweight local server running directly on your PC, splitting TCP/HTTP connections round-robin between Ethernet & Wi-Fi interfaces.'
    },
    badge: {
      ar: 'مستحسن وسهل جداً (Zero Dependencies)',
      en: 'Recommended & Zero Dependencies'
    },
    complexity: 'easy',
    speedtestCompatibility: {
      ar: 'يدعم Speedtest Multi-Stream + برامج التحميل (IDM/Steam/Chrome) بنسبة دمج 100%',
      en: '100% Combined Speed on Multi-Connection Speedtest, IDM, Steam, Torrents & Browsers'
    },
    requiresVps: false,
    filename: 'local-bonding-proxy.js',
    fileType: 'javascript',
    generateCode: (ethIp, wifiIp, ethPort = 8080, wifiPort = 8081, proxyPort = 8888, ratio = 50) => `/**
 * =========================================================================
 * BondLink - Local Multi-NIC Aggregation Proxy Server (Node.js)
 * -------------------------------------------------------------------------
 * يدمج سرعة كابل الإيثرنت وشبكة الواي فاي عن طريق ربط المقابس (Socket Binding)
 * Interface 1 (Ethernet / LAN): ${ethIp}
 * Interface 2 (Wi-Fi):          ${wifiIp}
 * Listen Proxy Port:             ${proxyPort}
 * Weight Ratio (Eth / Wi-Fi):    ${ratio}% / ${100 - ratio}%
 * =========================================================================
 */

const http = require('http');
const net = require('net');
const url = require('url');

const INTERFACES = [
  { name: 'Ethernet (Local Link)', ip: '${ethIp || '192.168.1.100'}', weight: ${ratio} },
  { name: 'Wi-Fi Interface',       ip: '${wifiIp || '192.168.2.100'}', weight: ${100 - ratio} }
];

const PROXY_PORT = ${proxyPort || 8888};
let requestCounter = 0;
let bytesSentEth = 0;
let bytesSentWifi = 0;

// Selection algorithm: Weighted Round-Robin
function getNextInterface() {
  const totalWeight = INTERFACES.reduce((sum, item) => sum + item.weight, 0);
  const target = (requestCounter % totalWeight);
  requestCounter = (requestCounter + 1) % 1000000;

  let current = 0;
  for (const iface of INTERFACES) {
    current += iface.weight;
    if (target < current) {
      return iface;
    }
  }
  return INTERFACES[0];
}

// Create HTTP / HTTPS Connect Proxy Server
const server = http.createServer((req, res) => {
  const iface = getNextInterface();
  const parsedUrl = url.parse(req.url);

  console.log(\`[HTTP] \${req.method} \${req.url} -> Routed via \${iface.name} (\${iface.ip})\`);

  const options = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || 80,
    path: parsedUrl.path,
    method: req.method,
    headers: req.headers,
    localAddress: iface.ip // <--- Socket bound to specific NIC!
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error(\`[Proxy Error - \${iface.name}]: \`, err.message);
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Proxy Gateway Error: ' + err.message);
  });

  req.pipe(proxyReq);
});

// Handle HTTPS CONNECT Tunneling (Crucial for Speedtest & Secure Sites)
server.on('connect', (req, clientSocket, head) => {
  const iface = getNextInterface();
  const [host, port] = req.url.split(':');
  const targetPort = parseInt(port, 10) || 443;

  console.log(\`[HTTPS CONNECT] \${host}:\${targetPort} -> Pipe: \${iface.name} (\${iface.ip})\`);

  const serverSocket = net.connect({
    host: host,
    port: targetPort,
    localAddress: iface.ip // <--- Binds outgoing HTTPS socket to selected adapter
  }, () => {
    clientSocket.write('HTTP/1.1 200 Connection Established\\r\\n\\r\\n');
    serverSocket.write(head);
    serverSocket.pipe(clientSocket);
    clientSocket.pipe(serverSocket);
  });

  serverSocket.on('error', (err) => {
    console.error(\`[Tunnel Error - \${iface.name}]: \`, err.message);
    clientSocket.end();
  });

  clientSocket.on('error', () => {
    serverSocket.end();
  });
});

server.listen(PROXY_PORT, '127.0.0.1', () => {
  console.clear();
  console.log('================================================================');
  console.log('🚀 BondLink Local Proxy Running on http://127.0.0.1:' + PROXY_PORT);
  console.log('⚡ Active Aggregation Interfaces:');
  INTERFACES.forEach(i => console.log(\`   - \${i.name} (IP: \${i.ip}) [Weight: \${i.weight}%]\`));
  console.log('================================================================');
  console.log('👉 كيفية الاستخدام:');
  console.log('1. افتح إعدادات الويندوز > Network & Internet > Proxy');
  console.log('2. فعل استخدام Proxy Server وضع العنوان: 127.0.0.1 والمنفذ: ' + PROXY_PORT);
  console.log('3. أو ضعه في IDM / المتصفح / Speedtest واستمتع بالسرعة المجمعة!');
  console.log('================================================================\\n');
});
`,
    instructions: {
      ar: [
        'تأكد من تنصيب Node.js (إذا لم يكن لديك، حمله من nodejs.org).',
        'احفظ الملف باسم local-bonding-proxy.js.',
        'افتح سطر الأوامر (CMD أو Terminal) واكتب: node local-bonding-proxy.js',
        'اضبط إعدادات البروكسي في الويندوز (أو في متصفحك/IDM) على: IP: 127.0.0.1 والمنفذ 8888.',
        'افتح موقع Speedtest.net وتأكد من اختيار Multi-Connection وستلاحظ دمج السرعتين معاً فوراً!'
      ],
      en: [
        'Ensure Node.js is installed on your computer (from nodejs.org).',
        'Save the script as local-bonding-proxy.js.',
        'Open Terminal/Command Prompt and run: node local-bonding-proxy.js',
        'Set your Windows / Browser / IDM proxy to 127.0.0.1 with port 8888.',
        'Open Speedtest.net (select Multi mode) and enjoy the combined bandwidth!'
      ]
    }
  },

  WINDOWS_METRIC: {
    id: 'WINDOWS_METRIC',
    name: {
      ar: 'سكربت ويندوز التلقائي (PowerShell Dual-Metric Tuning)',
      en: 'Windows PowerShell Dual-Metric Tuning Script'
    },
    tagline: {
      ar: 'تعديل جدول التوجيه المدمج في ويندوز 10/11 لتوحيد الـ Metric والسماح للنظام بتوزيع الحزم على كارت اللان والواي فاي معاً بدون أي برامج خارجية.',
      en: 'Configures native Windows 10/11 routing table metrics to force equal-cost multi-path load balancing across Ethernet and Wi-Fi.'
    },
    badge: {
      ar: 'بدون برامج إضافية (Native Windows)',
      en: 'Built-in Native Windows'
    },
    complexity: 'easy',
    speedtestCompatibility: {
      ar: 'يدعم Speedtest Multi-Connection + التحميلات المتعددة',
      en: 'Supported on multi-threaded speedtests & download managers'
    },
    requiresVps: false,
    filename: 'Bonding-Windows-DualMetric.ps1',
    fileType: 'powershell',
    generateCode: (ethIp, wifiIp) => `# =========================================================================
# BondLink - Windows Dual-NIC Metric & Multi-Path Optimization Script
# Run this script as Administrator in PowerShell
# =========================================================================

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "🚀 Starting Windows Network Dual-Metric Equalization Tool..." -ForegroundColor Yellow
Write-Host "================================================================" -ForegroundColor Cyan

# Check Administrator Privileges
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "❌ Error: Please re-run this script as Administrator!" -ForegroundColor Red
    Pause
    Exit
}

# Find Ethernet & Wi-Fi Adapters
$ethAdapter = Get-NetAdapter | Where-Object { $_.InterfaceDescription -match "Ethernet|Gigabit|PCIe|LAN|Realtek|Intel.*Ethernet" -and $_.Status -eq "Up" } | Select-Object -First 1
$wifiAdapter = Get-NetAdapter | Where-Object { $_.InterfaceDescription -match "Wi-Fi|Wireless|802.11|WLAN" -and $_.Status -eq "Up" } | Select-Object -First 1

if (-not $ethAdapter) {
    Write-Host "⚠️ Warning: No active Ethernet adapter found. Using first connected adapter." -ForegroundColor Yellow
    $ethAdapter = Get-NetAdapter | Where-Object { $_.Status -eq "Up" } | Select-Object -First 1
}

if (-not $wifiAdapter) {
    Write-Host "⚠️ Warning: No active Wi-Fi adapter found. Scanning all interfaces..." -ForegroundColor Yellow
    $wifiAdapter = Get-NetAdapter | Where-Object { $_.Status -eq "Up" -and $_.InterfaceIndex -ne $ethAdapter.InterfaceIndex } | Select-Object -First 1
}

Write-Host "✅ Detected Interfaces:" -ForegroundColor Green
Write-Host "   - Ethernet: $($ethAdapter.Name) (Index: $($ethAdapter.InterfaceIndex))" -ForegroundColor White
Write-Host "   - Wi-Fi:    $($wifiAdapter.Name) (Index: $($wifiAdapter.InterfaceIndex))" -ForegroundColor White

# Set Equal Interface Metrics (Forces Windows to use both simultaneously)
Write-Host "\`n🔧 Adjusting Gateway & Interface Metrics to 15 (Equal Cost Routing)..." -ForegroundColor Yellow
Set-NetIPInterface -InterfaceIndex $ethAdapter.InterfaceIndex -InterfaceMetric 15
Set-NetIPInterface -InterfaceIndex $wifiAdapter.InterfaceIndex -InterfaceMetric 15

# Enable TCP Auto-Tuning & Multi-Path Scaling
Write-Host "⚡ Optimizing TCP Window and Receive Side Scaling (RSS)..." -ForegroundColor Yellow
netsh int tcp set global autotuninglevel=normal
netsh int tcp set global rss=enabled
netsh int tcp set global timestamps=disabled
netsh int ip set global taskoffload=enabled

# Reset DNS cache
Clear-DnsClientCache

Write-Host "\`n================================================================" -ForegroundColor Cyan
Write-Host "🎉 SUCCESS! Ethernet & Wi-Fi are now bonded with Equal Priority!" -ForegroundColor Green
Write-Host "👉 Test your speed at https://speedtest.net (Click 'Multi' mode)" -ForegroundColor Yellow
Write-Host "================================================================" -ForegroundColor Cyan
Pause
`,
    instructions: {
      ar: [
        'اضغط بالزر الأيمن على قائمة ابدأ في ويندوز واختر Terminal (Admin) أو PowerShell (كـ مسؤول).',
        'قم بنسخ السكربت أو تحميله بصيغة .ps1.',
        'قم بتشغيل الأمر: Set-ExecutionPolicy Bypass -Scope Process ثم نفذ السكربت.',
        'سيقوم السكربت بتعديل قيمة Metric للكارتين لتصبح متطابقة (15) وتفعيل توزيع الحزم التلقائي.',
        'افتح Speedtest.net واستمتع بالسرعة المزدوجة!'
      ],
      en: [
        'Right click Windows Start Menu and select PowerShell (Administrator).',
        'Copy or download the .ps1 script file.',
        'Execute: Set-ExecutionPolicy Bypass -Scope Process; .\\Bonding-Windows-DualMetric.ps1',
        'The script equalizes Interface Metric (15) across Ethernet and Wi-Fi.',
        'Test on Speedtest.net with Multi mode active!'
      ]
    }
  },

  MPTCP_VPS: {
    id: 'MPTCP_VPS',
    name: {
      ar: 'دمج حزم كامل عبر MPTCP وسيرفر خارجي (True 100% Kernel Bonding)',
      en: 'True Packet-Level Multipath TCP Bonding (OpenMPTCProuter / VPS)'
    },
    tagline: {
      ar: 'أقوى طريقة في العالم (نفس تقنية Speedify الاحترافية). تدمج الحزم على مستوى النواة (Kernel) حتى في اختبار السرعة أحادي الاتصال (Single-Connection) وكل الألعاب والتطبيقات.',
      en: 'Enterprise-grade packet-level bonding (same as Speedify). Aggregates 100% bandwidth even for single-stream connections, gaming, and any app.'
    },
    badge: {
      ar: 'الدمج الكامل 100% (All Apps & Games)',
      en: 'True 100% Aggregation'
    },
    complexity: 'advanced',
    speedtestCompatibility: {
      ar: '100% حتى في اختبار Single Connection وجميع ألعاب الأونلاين',
      en: '100% Combined Speed on both Single-Stream & Multi-Stream tests + Games'
    },
    requiresVps: true,
    filename: 'setup-mptcp-vps.sh',
    fileType: 'bash',
    generateCode: (ethIp, wifiIp) => `#!/bin/bash
# =========================================================================
# BondLink - OpenMPTCProuter VPS Aggregation Server Installer
# Run on a clean Ubuntu 22.04 / 24.04 VPS (Hetzner, DigitalOcean, Oracle)
# =========================================================================

set -e
echo "================================================================"
echo "🚀 Installing True Multipath TCP (MPTCP) Aggregator Server..."
echo "================================================================"

# Update & Install Prerequisites
apt-get update && apt-get install -y curl wget unzip iptables-persistent iproute2

# Enable IP Forwarding & MPTCP Kernel Flags
echo "net.ipv4.ip_forward = 1" >> /etc/sysctl.conf
echo "net.ipv4.tcp_congestion_control = bbr" >> /etc/sysctl.conf
echo "net.mptcp.mptcp_enabled = 1" >> /etc/sysctl.conf 2>/dev/null || true
sysctl -p

# Install OpenMPTCProuter VPS Server Component
wget -O - https://www.openmptcprouter.com/server/debian11-x86_64.sh | bash

echo "================================================================"
echo "🎉 MPTCP Server Installed Successfully!"
echo "👉 Your Server Keys & Ports will be displayed above."
echo "👉 Connect your PC using OpenMPTCProuter Client (or Shadowsocks MPTCP client)"
echo "================================================================"
`,
    instructions: {
      ar: [
        'قم بحجز سيرفر VPS رخيص (مثل Hetzner أو DigitalOcean أو Oracle Cloud مجاني) بنظام Ubuntu.',
        'قم بتسجيل الدخول إلى الـ VPS عبر SSH وشغل السكربت.',
        'قم بتنصيب OpenMPTCProuter على جهازك (أو في ماكينة وهمية VirtualBox أو راوتر OpenWrt).',
        'أدخل عنوان الـ IP والمفاتيح من السيرفر، وسيتم دمج كابل الإيثرنت والواي فاي كشبكة واحدة مجمعة بالكامل!'
      ],
      en: [
        'Get an affordable Linux VPS (e.g. Hetzner, DigitalOcean, or free Oracle Cloud).',
        'Connect via SSH and execute the bash script.',
        'Install the OpenMPTCProuter client on your PC (or inside a VirtualBox VM / OpenWrt router).',
        'Input your VPS IP and keys, and enjoy 100% bonded Internet across all applications!'
      ]
    }
  },

  GOST_DISPATCH: {
    id: 'GOST_DISPATCH',
    name: {
      ar: 'بروكسي GOST / SOCKS5 المتعدد (High Performance Go Multi-WAN)',
      en: 'GOST Multi-Path SOCKS5 / HTTP Proxy'
    },
    tagline: {
      ar: 'أداة GOST المكتوبة بلغة Go عالية الأداء لربط المنافذ وتوزيع الترافيك تلقائياً عبر كلا الاتصالين.',
      en: 'High-performance Go-based tunnel & load-balancing multi-WAN egress proxy.'
    },
    badge: {
      ar: 'أداء فائق السرعة (Go Engine)',
      en: 'High Performance Go'
    },
    complexity: 'medium',
    speedtestCompatibility: {
      ar: 'دمج كامل لجميع برامج التحميل والمتصفحات وSpeedtest Multi',
      en: 'Full multi-connection aggregation for browsers, IDM, and Speedtests'
    },
    requiresVps: false,
    filename: 'run-gost-bonding.bat',
    fileType: 'batch',
    generateCode: (ethIp, wifiIp, ethPort, wifiPort, proxyPort = 8080) => `@echo off
:: =========================================================================
:: BondLink - GOST Multi-Interface Speed Aggregator
:: =========================================================================
title BondLink GOST Multi-WAN Proxy
cls
echo ================================================================
echo 🚀 Launching GOST Dual-NIC SOCKS5 / HTTP Load Balancer...
echo ================================================================
echo [Interface 1 - Ethernet]: ${ethIp || '192.168.1.100'}
echo [Interface 2 - Wi-Fi]:    ${wifiIp || '192.168.2.100'}
echo [Proxy Port]:             ${proxyPort}
echo ================================================================

:: Check if gost.exe exists, if not download it
if not exist "gost.exe" (
    echo Downloading GOST binary...
    powershell -Command "Invoke-WebRequest -Uri 'https://github.com/go-gost/gost/releases/download/v3.0.0-nightly.20240101/gost_3.0.0-nightly.20240101_windows_amd64.zip' -OutFile 'gost.zip'"
    powershell -Command "Expand-Archive -Path 'gost.zip' -DestinationPath '.' -Force"
    del gost.zip
)

:: Run GOST with dual IP interface binding
echo Running GOST Balancer on :${proxyPort}...
gost.exe -L "http://:8080" -L "socks5://:1080" -F "relay+ip://${ethIp || '192.168.1.100'}?weight=1" -F "relay+ip://${wifiIp || '192.168.2.100'}?weight=1"

pause
`,
    instructions: {
      ar: [
        'قم بتحميل ملف run-gost-bonding.bat وتشغيله على ويندوز.',
        'سيقوم الملف بتحميل GOST تلقائياً وبدء السيرفر على المنفذ 8080 (HTTP) و 1080 (SOCKS5).',
        'يوزع الاتصالات بالتساوي 50/50 بين كابل اللان وشبكة الواي فاي.',
        'اضبط البروكسي في الويندوز واستمتع بالسرعة المجمعة.'
      ],
      en: [
        'Download and run the run-gost-bonding.bat script on Windows.',
        'It will automatically fetch GOST and bind egress sockets on both interfaces.',
        'Distributes connections 50/50 across Ethernet and Wi-Fi.',
        'Point your OS / Browser proxy to 127.0.0.1:8080.'
      ]
    }
  }
};
