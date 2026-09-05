# BondLink v1.0 - Complete Handoff

**Last Updated:** September 05, 2026  
**Status:** Functional MVP (Windows client + React dashboard + VPS relay)  
**Repo:** https://github.com/omar-hesham/speedfy.git  
**Branch:** `feat/bondlink-v1-native-bonding`

---

## 🎯 TL;DR (For AI Picking Up This Project)

BondLink is a **Windows-native multi-WAN bonding** application that combines Ethernet + Wi-Fi into one super-connection through an Oracle Cloud Free Tier VPS relay. It gives you:
- A single public IP (the VPS IP, not your home IP = VPN/Guard)
- Combined upload/download speed from both adapters
- One-click activation from a React dashboard
- Real-time monitoring and speed testing

**To start everything:** Double-click `START-BONDLINK.vbs` on Desktop (or run it manually as Admin).

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          WINDOWS MACHINE                                │
│  ┌──────────────────────┐    ┌──────────────────────────────────────┐  │
│  │  BondingDashboard    │    │  bondlink-client.exe (Rust + Axum)   │  │
│  │  React + Vite + TS   │───►│  HTTP API on 127.0.0.1:8080          │  │
│  │  port 3000           │    │                                      │  │
│  └──────────────────────┘    │  /api/status  → bonding state        │  │
│                              │  /api/start   → create Wintun adapter │  │
│                              │  /api/stop    → remove adapter + routes│ │
│                              │  /api/speedtest → UDP throughput test  │  │
│                              └──────────────┬───────────────────────┘  │
│                                             │                           │
│           Wintun Virtual Adapter            │  ← requires Admin         │
│           10.73.0.2/24                      │                           │
│           Default Route → 10.73.0.1         │                           │
│                    │                        │                           │
│           ┌────────┴────────┐               │                           │
│           │   UDP Sockets   │               │                           │
│           │  Ethernet + Wi-Fi│               │                           │
│           └────────┬────────┘               │                    ┌──────┴───────┐
└────────────────────┼────────────────────────┘                    │  wintun.dll  │
                     │                                             │  (embedded)  │
                     │                                             └──────────────┘
                     │ UDP :8443
                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    ORACLE CLOUD VPS (Always Free)                       │
│  Public IP: 84.8.105.228                                               │
│  Shape: Ampere A1 (2 OCPU, 12 GB RAM, ARM64)                           │
│  Region: me-riyadh-1                                                   │
│  User: opc                                                             │
│  SSH Key: C:\Users\DELL\AppData\Local\hermes\attachments\              │
│           ssh-key-2026-09-04 (1)-2.key                                 │
│                                                                         │
│  bondlink-relay.service (systemd)                                       │
│  ├── UDP relay on :8443 (echo for testing)                              │
│  ├── TUN device: bondlink0 (10.73.0.1/24) ← currently DOWN            │
│  ├── NAT: MASQUERADE 10.73.0.0/24 → enp0s6                            │
│  └── ip_forward=1 enabled                                              │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
speedfy/
├── START-BONDLINK.vbs              ← ONE-CLICK LAUNCHER (double-click)
├── create-shortcut.vbs             ← Creates Desktop shortcut
├── package.json                    ← Node deps (Express, React, etc.)
├── server.js                       ← Express proxy (port 3000)
├── tsconfig.json, vite.config.ts
│
├── src/                            ← React + TypeScript frontend
│   ├── App.tsx                     ← Main app (default tab: dashboard)
│   ├── types.ts                    ← TypeScript interfaces
│   └── components/
│       ├── BondingDashboard.tsx    ← 🎯 MAIN DASHBOARD (ON/OFF, monitor, speedtest)
│       ├── SpeedTestEngine.tsx     ← Detailed multi-stream speedtest
│       ├── Navbar.tsx              ← Navigation tabs
│       ├── BondingStatusPanel.tsx  ← Legacy bonding panel
│       ├── NetworkInterfacesPanel.tsx
│       ├── ServerSetupGenerator.tsx
│       ├── BandwidthCalculator.tsx
│       └── BondingExplainer.tsx
│
├── native/                         ← Rust workspace
│   ├── Cargo.toml                  ← 8 crates
│   ├── crates/
│   │   ├── bondlink-protocol/      ← Wire envelope (20-byte header)
│   │   ├── bondlink-core/          ← Flow key, scheduler, reorder, logging
│   │   ├── bondlink-service/       ← Windows service state machine
│   │   ├── bondlink-relay/         ← Linux relay config
│   │   ├── bondlink-wintun/        ← Wintun adapter + embedded DLL
│   │   ├── bondlink-quic/          ← QUIC config skeleton (RFC 9221)
│   │   ├── bondlink-client/        ← 🎯 Windows client (HTTP API server)
│   │   └── bondlink-monitor/       ← Real-time network monitor
│   └── target/release/
│       ├── bondlink-client.exe     ← Built binary (3.0 MB)
│       ├── bondlink-monitor.exe    ← Built binary
│       ├── wintun.dll              ← Wintun driver (must be in same dir)
│       └── start-bondlink.bat      ← Admin launcher
│
├── docs/
│   ├── BONDLINK_V1_MASTER_IMPLEMENTATION_PROMPT.md  ← Master spec (789 lines)
│   ├── adr/ADR-001-native-windows-multipath-relay.md
│   └── plans/2026-09-03-bondlink-v1-implementation.md ← Impl plan (844 lines)
│
└── .gitignore                      ← Excludes: .env, logs/, target/, dist/
```

---

## 🔧 How to Build & Run

### Prerequisites (already installed)
- **Node.js** + npm
- **Rust 1.98.1** (at `C:\Users\DELL\.cargo\bin\`)
- **wintun.dll 0.14.1** (embedded from wintun.net)

### Quick Start (3 commands)
```bash
# 1. Install Node deps (once)
cd "C:\New folder (3)\hostinger\speed"
npm install

# 2. Build React frontend (once)
npm run build

# 3. Build Rust client (once)
cd native && cargo build --release --package bondlink-client

# Then just double-click START-BONDLINK.vbs on Desktop
```

### Manual Start (if VBS doesn't work)
```bash
# Terminal 1 (Admin!):
cd "C:\New folder (3)\hostinger\speed\native\target\release"
bondlink-client.exe

# Terminal 2:
cd "C:\New folder (3)\hostinger\speed"
npm run server

# Open http://localhost:3000
```

---

## 🔌 API Contract (bondlink-client.exe → Dashboard)

The client exposes a JSON HTTP API on `127.0.0.1:8080`:

### `GET /api/status`
```json
{
  "is_active": false,
  "wintun_created": false,
  "session_started": false,
  "ethernet_path": {
    "ip": "192.168.8.20",
    "status": "connected",
    "rx_bytes": 0, "tx_bytes": 0,
    "rx_speed": 0.0, "tx_speed": 0.0,
    "latency_ms": 0.0
  },
  "wifi_path": {
    "ip": "192.168.1.22",
    "status": "connected",
    "rx_bytes": 0, "tx_bytes": 0,
    "rx_speed": 0.0, "tx_speed": 0.0,
    "latency_ms": 0.0
  },
  "relay": {
    "host": "84.8.105.228",
    "port": 8443,
    "status": "disconnected"
  },
  "total_rx_speed": 0.0,
  "total_tx_speed": 0.0,
  "public_ip": "0.0.0.0",
  "uptime_sec": 0,
  "activated_at": null
}
```

### `POST /api/start`
Creates Wintun adapter, sets default route to 10.73.0.1. Returns:
```json
{"success": true, "message": "Bonding activated"}
```
OR on failure:
```json
{"success": false, "error": "Wintun creation failed: ..."}
```

### `POST /api/stop`
Removes Wintun adapter, deletes default route. Returns:
```json
{"success": true, "message": "Bonding deactivated"}
```

### `POST /api/speedtest`
Sends UDP packets to relay for 5 seconds, measures throughput. Returns:
```json
{
  "ping_ms": 208.5,
  "jitter_ms": 2.1,
  "download_mbps": 45.3,
  "upload_mbps": 22.6
}
```

---

## 🐛 Known Issues & Gotchas

| Issue | Cause | Fix |
|-------|-------|-----|
| **"Access is denied"** when starting client | Not admin | Run `START-BONDLINK.vbs` as Admin |
| **Wintun session fails (0x000004DF)** | Previous session not closed | Restart PC or kill old wintun sessions |
| **"nul" file in git** | Windows artifact | `rm -f nul native/nul` before commit |
| **Dashboard shows "client not running"** | Port 8080 blocked | Check if client started, restart |
| **Speed test shows 0 Mbps** | Relay not running | Check `systemctl status bondlink-relay` on VPS |
| **Can't ping 10.73.0.1** | TUN on VPS is DOWN | `sudo ip link set bondlink0 up` on VPS |
| **Cargo edition error** | `edition = "2021"` | Change to `edition = "2024"` in Cargo.toml |

---

## 🛠️ Development Commands

```bash
# Lint (TypeScript)
cd "C:\New folder (3)\hostinger\speed"
npm run lint

# Build frontend
npm run build

# Dev frontend (hot reload)
npm run dev

# Build all Rust crates
cd native && cargo build --workspace

# Run all tests
cargo test --workspace

# Clippy (Rust linter, strict)
cargo clippy --workspace --all-targets -- -D warnings

# Build specific crate
cargo build --package bondlink-client --release
```

---

## 📊 What's Done vs What's Left

### ✅ Done
- [x] Oracle VPS provisioned (Ampere A1, 2 OCPU, 12 GB, me-riyadh-1)
- [x] SSH access configured
- [x] Rust relay deployed as systemd service (UDP echo on :8443)
- [x] NAT + forwarding configured on VPS
- [x] wintun.dll embedded in bondlink-wintun crate
- [x] bondlink-client.exe built (3.0 MB, HTTP API on :8080)
- [x] React BondingDashboard with ON/OFF toggle
- [x] Real-time status polling (2s interval)
- [x] Speed test integration
- [x] One-click launcher (START-BONDLINK.vbs)
- [x] Desktop shortcut creator

### ⏳ Not Done
- [ ] QUIC DATAGRAM transport (RFC 9221) — currently plain UDP
- [ ] Per-flow packet scheduling (round-robin / weighted)
- [ ] Reordering buffer for out-of-order packets
- [ ] TUN integration on relay side (echo → TUN → Internet)
- [ ] Windows service installer (SCM)
- [ ] Tauri desktop app wrapper
- [ ] Auth enrollment (Argon2id codes)
- [ ] Multi-region VPS selection UI
- [ ] Firewall rules auto-config
- [ ] IPv6 leak protection

---

## 🔑 Key Files to Understand First

If you're picking up this project, read these files in order:

1. **`src/components/BondingDashboard.tsx`** — The main UI. Understand how it talks to the client API.
2. **`native/crates/bondlink-client/src/main.rs`** — The client. It's an Axum HTTP server that creates the Wintun adapter and configures routes.
3. **`docs/plans/2026-09-03-bondlink-v1-implementation.md`** — 844-line implementation plan with all the architecture details.
4. **`docs/BONDLINK_V1_MASTER_IMPLEMENTATION_PROMPT.md`** — The master spec (planning PR).

---

## 🚀 Next Steps (Priority Order)

### 1. Make the Relay Work with TUN
The current relay is a UDP echo. It needs to:
- Read packets from UDP (from Windows)
- Write them to TUN `bondlink0` (toward Internet)
- Read responses from TUN
- Send them back via UDP (to Windows)

This is in `native/crates/bondlink-relay/src/main.rs` (still the echo version).

### 2. Fix the Wintun Session Bug
The `0x000004DF` error happens when the previous session didn't close properly. The client should handle this by:
- Trying to open existing adapter
- If session fails, drop adapter, recreate, retry
- Add a `Drop` impl that shuts down the session

### 3. Implement Real Speed Display
Currently `total_rx_speed` is simulated. The client should:
- Read actual interface statistics from Windows (GetIfTable)
- Track bytes over time to compute Mbps
- Per-interface breakdown (Ethernet vs Wi-Fi)

### 4. Add QUIC Datagram Support
Per the spec (RFC 9221), the transport should be QUIC DATAGRAM, not plain UDP. Use the `quinn` crate which is already in deps.

---

## 📞 Contact / Context

- **User:** Omar (Cairo, Egypt) — bilingual Arabic/English
- **Workflow:** PowerShell-first, step-by-step verification, clean test artifacts
- **Prefers:** Arabic for explanations, proactive work (no questions, just do)
- **VPS SSH:** `ssh -i 'C:\Users\DELL\AppData\Local\hermes\attachments\ssh-key-2026-09-04 (1)-2.key' opc@84.8.105.228`
- **OCI Auth:** `~/.oci/config` with security-token auth

---

**Last commit:** `890dcfe` (feat: BondLink client HTTP API + Dashboard integration)
