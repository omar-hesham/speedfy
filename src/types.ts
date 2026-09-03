export type BondingMode = 
  | 'NODE_PROXY'        // Local Node.js Multi-Socket Proxy (Round-Robin / Weighted)
  | 'MPTCP_VPS'         // Multipath TCP + VPS (True Packet-Level Bonding)
  | 'WINDOWS_METRIC'    // Windows Dual-Gateway Metric Equalization
  | 'GOST_DISPATCH';    // Gost / SOCKS5 Multi-Interface Forwarder

export type Language = 'ar' | 'en';

export interface NetworkInterfaceConfig {
  id: string;
  name: string;
  type: 'ethernet' | 'wifi';
  ipAddress: string;
  gateway: string;
  subnetMask: string;
  metric: number;
  nominalSpeedMbps: number;
  currentSpeedMbps: number;
  latencyMs: number;
  jitterMs: number;
  packetLossPercent: number;
  isActive: boolean;
  macAddress: string;
  wifiSsid?: string;
  wifiSignalDbm?: number;
  wifiFrequency?: '2.4 GHz' | '5.0 GHz' | '6.0 GHz';
}

export interface SpeedTestState {
  status: 'idle' | 'pinging' | 'downloading' | 'uploading' | 'completed' | 'error';
  progress: number; // 0 to 100
  pingMs: number;
  jitterMs: number;
  downloadSpeedCombined: number; // Mbps
  downloadSpeedEthernet: number; // Mbps
  downloadSpeedWifi: number;     // Mbps
  uploadSpeedCombined: number;   // Mbps
  uploadSpeedEthernet: number;   // Mbps
  uploadSpeedWifi: number;       // Mbps
  bufferbloatGrade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  historyData: SpeedSample[];
  totalBytesDownloadedMb: number;
  totalBytesUploadedMb: number;
  efficiencyPercent: number; // e.g. 96% of theoretical max
}

export interface SpeedSample {
  timeSec: number;
  ethernetMbps: number;
  wifiMbps: number;
  combinedMbps: number;
  targetMbps: number;
}

export interface ServerTemplate {
  id: BondingMode;
  name: { ar: string; en: string };
  tagline: { ar: string; en: string };
  badge: { ar: string; en: string };
  complexity: 'easy' | 'medium' | 'advanced';
  speedtestCompatibility: { ar: string; en: string }; // e.g. "Multi-Connection 100% / Single-Connection requires MPTCP"
  requiresVps: boolean;
  filename: string;
  fileType: string;
  generateCode: (ethIp: string, wifiIp: string, ethPort?: number, wifiPort?: number, proxyPort?: number, ratio?: number) => string;
  instructions: {
    ar: string[];
    en: string[];
  };
}
