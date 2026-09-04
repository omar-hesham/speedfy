# BondLink

BondLink is an experimental Windows multi-WAN project for using Ethernet and Wi-Fi together.

> **Project status:** The checked-in application is a diagnostic/socket-distribution prototype. It is **not yet** the planned native full-tunnel bonding product and must not be presented as guaranteed single-flow aggregation or lower gaming latency.

## Current prototype

The current TypeScript/React and Node.js prototype provides:

- discovery and selection of Windows IPv4 network interfaces;
- per-interface and concurrent throughput diagnostics;
- an HTTP/HTTPS proxy that assigns separate outbound sockets to selected local interfaces;
- routing snapshots and an explicit UAC-gated Windows route-metric helper;
- Arabic and English UI.

The proxy can distribute multiple proxy-aware connections. It does not capture every application, create one virtual network adapter, or reconstruct traffic through one public egress IP.

## Planned native BondLink v1

The reviewed planning direction is a **native Windows client** plus a **user-owned Oracle Linux relay**:

- Wintun virtual IPv4 adapter on the client;
- privileged Rust Windows networking service on the client;
- two independently interface-pinned QUIC DATAGRAM paths;
- Oracle Cloud Always Free VPS (Ampere A1 ARM64, Ubuntu) as relay;
- Linux TUN + nftables relay with one public IPv4 egress;
- bounded, mode-aware scheduling and failover;
- DNS/IPv6 leak controls and crash-safe network restoration;
- React/Tauri desktop UI.

Planning documents:

- [BondLink v1 Master Implementation Prompt](docs/BONDLINK_V1_MASTER_IMPLEMENTATION_PROMPT.md)
- [ADR-001: Native Windows multipath tunnel through an Oracle Linux relay](docs/adr/ADR-001-native-windows-multipath-relay.md)

Both documents remain **Draft / Proposed** until the planning PR is reviewed and merged. Runtime implementation must be developed in a separate branch and PR.

## Architecture

```
┌──────────────────────────────────────────────┐
│ Windows Client                               │
│  ┌─────────┐  ┌─────────┐  ┌──────────────┐ │
│  │ Wintun  │  │ QUIC    │  │ Service      │ │
│  │ Adapter │◄─┤ 2 paths │◄─┤ State Machine│ │
│  └─────────┘  └─────────┘  └──────────────┘ │
│       ▲                              │       │
│       │                              ▼       │
│  Ethernet/Wi-Fi              Named Pipe IPC   │
└──────────────────────────────────────────────┘
                    │ QUIC DATAGRAMs
                    ▼
┌──────────────────────────────────────────────┐
│ Oracle Cloud Always Free VPS (Linux/Ubuntu)  │
│  ┌─────────┐  ┌─────────┐  ┌──────────────┐ │
│  │ Linux   │  │ QUIC    │  │ nftables     │ │
│  │ TUN     │◄─┤ Listener│◄─┤ NAT/Forward  │ │
│  └─────────┘  └─────────┘  └──────────────┘ │
│                                     │        │
│                                     ▼        │
│                              Public IPv4     │
└──────────────────────────────────────────────┘
```

## Run the current prototype

### Prerequisites

- Windows 10/11
- Node.js 20 or newer
- npm or Bun

### Install

```bash
npm install
```

No Gemini or other AI API key is required by the current runtime path.

### Start the backend

```bash
npm run server
```

The local API listens on port `3001`; the prototype proxy listens on port `8888`.

### Start the UI

In a second terminal:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Verification

```bash
npm run lint
npm run build
```

## Safety notes

- Do not expose ports `3001` or `8888` to untrusted networks.
- Route-metric changes require UAC and can interrupt connectivity; review diagnostics before accepting elevation.
- Runtime logs under `logs/`, local environment files, generated builds, and agent metadata are ignored by Git.
- Do not treat the current UI's historical "100% aggregation" wording as a verified product guarantee; correcting those claims is an implementation acceptance criterion.

## License

No license has been selected yet. Until one is added, normal copyright restrictions apply.
