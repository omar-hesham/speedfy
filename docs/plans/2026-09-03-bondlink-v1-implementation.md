# BondLink v1 Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Build a native Windows application that combines Ethernet and Wi-Fi IPv4 traffic through an Oracle Cloud VPS relay, presenting one virtual network adapter and one public egress IP.

**Architecture:** Windows Rust service (Wintun virtual adapter + dual QUIC DATAGRAM paths) → Oracle Linux relay (TUN + nftables + single public IPv4) → React/Tauri desktop UI.

**Tech Stack:** Rust (service, protocol, core), React + Tauri (UI), Node.js (existing prototype), Linux shell (relay installer).

---

## Task 1: Create Rust workspace structure

**Objective:** Initialize the Rust workspace with crates for protocol, core, service, and relay.

**Files:**
- Create: `native/Cargo.toml`
- Create: `native/crates/bondlink-protocol/Cargo.toml`
- Create: `native/crates/bondlink-core/Cargo.toml`
- Create: `native/crates/bondlink-service/Cargo.toml`
- Create: `native/crates/bondlink-relay/Cargo.toml`

**Step 1: Create workspace root**

```toml
[workspace]
members = [
    "crates/bondlink-protocol",
    "crates/bondlink-core",
    "crates/bondlink-service",
    "crates/bondlink-relay",
]
resolver = "2"

[workspace.package]
version = "0.1.0"
edition = "2021"
license = "MIT"

[workspace.dependencies]
tokio = { version = "1", features = ["full"] }
quinn = "0.11"
rustls = { version = "0.23", features = ["ring"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
bytes = "1"
tracing = "0.1"
tracing-subscriber = "0.3"
thiserror = "2"
anyhow = "1"
```

**Step 2: Commit**

```bash
git add native/
git commit -m "chore: initialize BondLink Rust workspace"
```

---

## Task 2: Implement bondlink-protocol crate

**Objective:** Define the wire protocol, envelope types, and codec with exact binary round-trip tests.

**Files:**
- Create: `native/crates/bondlink-protocol/src/lib.rs`
- Create: `native/crates/bondlink-protocol/src/envelope.rs`
- Create: `native/crates/bondlink-protocol/src/codec.rs`
- Create: `native/crates/bondlink-protocol/tests/envelope.rs`

**Step 1: Write failing test**

```rust
// native/crates/bondlink-protocol/tests/envelope.rs
use bondlink_protocol::envelope::{WireEnvelope, WireKind};

#[test]
fn round_trip_data_envelope() {
    let original = WireEnvelope::new_data(1, 0x0001, 1_000_000, b"hello world");
    let bytes = original.encode();
    let decoded = WireEnvelope::decode(&bytes).unwrap();
    assert_eq!(decoded.version(), 1);
    assert_eq!(decoded.kind(), WireKind::Data);
    assert_eq!(decoded.sequence(), 1);
    assert_eq!(decoded.flags(), 0x0001);
    assert_eq!(decoded.sent_monotonic_micros(), 1_000_000);
    assert_eq!(decoded.payload(), b"hello world");
}

#[test]
fn reject_unknown_version() {
    let mut bytes = WireEnvelope::new_data(1, 0, 0, b"x").encode();
    bytes[0] = 99; // corrupt version
    assert!(WireEnvelope::decode(&bytes).is_err());
}

#[test]
fn reject_truncated_payload() {
    let bytes = &[0x11u8, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x05][];
    assert!(WireEnvelope::decode(bytes).is_err());
}
```

**Step 2: Run test to verify failure**

Run: `cargo test --package bondlink-protocol`
Expected: FAIL — "crate not found"

**Step 3: Implement envelope types**

```rust
// native/crates/bondlink-protocol/src/envelope.rs
use bytes::{Buf, BufMut, Bytes, BytesMut};
use thiserror::Error;

pub const WIRE_VERSION: u8 = 1;
pub const WIRE_HEADER_LEN: usize = 20;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum WireKind {
    Data = 0x01,
    Probe = 0x02,
    Ack = 0x03,
    Control = 0x04,
}

#[derive(Debug, Error)]
pub enum EnvelopeError {
    #[error("unsupported wire version {0}")]
    UnsupportedVersion(u8),
    #[error("truncated header: got {0}, need {1}")]
    TruncatedHeader(usize, usize),
    #[error("truncated payload: header says {0}, got {1}")]
    TruncatedPayload(usize, usize),
    #[error("unknown wire kind {0}")]
    UnknownKind(u8),
}

#[derive(Debug, Clone)]
pub struct WireEnvelope {
    version: u8,
    kind: WireKind,
    flags: u16,
    sequence: u64,
    sent_monotonic_micros: u64,
    payload: Bytes,
}

impl WireEnvelope {
    pub fn new_data(sequence: u64, flags: u16, sent_monotonic_micros: u64, payload: &[u8]) -> Self {
        Self {
            version: WIRE_VERSION,
            kind: WireKind::Data,
            flags,
            sequence,
            sent_monotonic_micros,
            payload: Bytes::copy_from_slice(payload),
        }
    }

    pub fn encode(&self) -> BytesMut {
        let payload_len = self.payload.len();
        let total = WIRE_HEADER_LEN + payload_len;
        let mut buf = BytesMut::with_capacity(total);
        buf.put_u8(self.version);
        buf.put_u8(self.kind as u8);
        buf.put_u16(self.flags);
        buf.put_u64(self.sequence);
        buf.put_u64(self.sent_monotonic_micros);
        buf.extend_from_slice(&self.payload);
        buf
    }

    pub fn decode(buf: &[u8]) -> Result<Self, EnvelopeError> {
        if buf.len() < WIRE_HEADER_LEN {
            return Err(EnvelopeError::TruncatedHeader(buf.len(), WIRE_HEADER_LEN));
        }
        let version = buf[0];
        if version != WIRE_VERSION {
            return Err(EnvelopeError::UnsupportedVersion(version));
        }
        let kind = match buf[1] {
            0x01 => WireKind::Data,
            0x02 => WireKind::Probe,
            0x03 => WireKind::Ack,
            0x04 => WireKind::Control,
            other => return Err(EnvelopeError::UnknownKind(other)),
        };
        let flags = u16::from_be_bytes([buf[2], buf[3]]);
        let sequence = u64::from_be_bytes(buf[4..12].try_into().unwrap());
        let sent_monotonic_micros = u64::from_be_bytes(buf[12..20].try_into().unwrap());
        let payload = Bytes::copy_from_slice(&buf[20..]);
        Ok(Self {
            version,
            kind,
            flags,
            sequence,
            sent_monotonic_micros,
            payload,
        })
    }

    pub fn version(&self) -> u8 { self.version }
    pub fn kind(&self) -> WireKind { self.kind }
    pub fn flags(&self) -> u16 { self.flags }
    pub fn sequence(&self) -> u64 { self.sequence }
    pub fn sent_monotonic_micros(&self) -> u64 { self.sent_monotonic_micros }
    pub fn payload(&self) -> &[u8] { &self.payload }
}
```

**Step 4: Run test to verify pass**

Run: `cargo test --package bondlink-protocol`
Expected: PASS

**Step 5: Commit**

```bash
git add native/crates/bondlink-protocol/
git commit -m "feat(protocol): add wire envelope codec with round-trip tests"
```

---

## Task 3: Implement bondlink-core flow key and scheduler

**Objective:** Canonical bidirectional flow identity, weighted scheduler, and reordering buffer.

**Files:**
- Create: `native/crates/bondlink-core/src/lib.rs`
- Create: `native/crates/bondlink-core/src/flow_key.rs`
- Create: `native/crates/bondlink-core/src/scheduler.rs`
- Create: `native/crates/bondlink-core/src/reorder.rs`
- Create: `native/crates/bondlink-core/tests/flow_key.rs`
- Create: `native/crates/bondlink-core/tests/scheduler.rs`
- Create: `native/crates/bondlink-core/tests/reorder.rs`

**Step 1: Write failing flow_key test**

```rust
// native/crates/bondlink-core/tests/flow_key.rs
use bondlink_core::flow_key::FlowKey;

#[test]
fn bidirectional_flow_identity() {
    let a = FlowKey::new(&[192,168,1,100], &[8,8,8,8], 54321, 443, 6);
    let b = FlowKey::new(&[8,8,8,8], &[192,168,1,100], 443, 54321, 6);
    assert_eq!(a.canonical(), b.canonical());
}

#[test]
fn different_protocols_are_distinct() {
    let tcp = FlowKey::new(&[10,0,0,1], &[10,0,0,2], 1234, 80, 6);
    let udp = FlowKey::new(&[10,0,0,1], &[10,0,0,2], 1234, 80, 17);
    assert_ne!(tcp.canonical(), udp.canonical());
}
```

**Step 2: Run test to verify failure**

Run: `cargo test --package bondlink-core`
Expected: FAIL — "unresolved import"

**Step 3: Implement flow key**

```rust
// native/crates/bondlink-core/src/flow_key.rs
use std::hash::{Hash, Hasher};

#[derive(Debug, Clone)]
pub struct FlowKey {
    src_ip: [u8; 4],
    dst_ip: [u8; 4],
    src_port: u16,
    dst_port: u16,
    protocol: u8,
}

impl FlowKey {
    pub fn new(src_ip: &[u8; 4], dst_ip: &[u8; 4], src_port: u16, dst_port: u16, protocol: u8) -> Self {
        Self { src_ip: *src_ip, dst_ip: *dst_ip, src_port, dst_port, protocol }
    }

    pub fn canonical(&self) -> ([u8; 8], [u8; 8], u8) {
        let mut a = [0u8; 8];
        let mut b = [0u8; 8];
        a[..4].copy_from_slice(&self.src_ip);
        a[4..].copy_from_slice(&self.src_port.to_be_bytes());
        b[..4].copy_from_slice(&self.dst_ip);
        b[4..].copy_from_slice(&self.dst_port.to_be_bytes());
        if a <= b {
            (a, b, self.protocol)
        } else {
            (b, a, self.protocol)
        }
    }
}

impl PartialEq for FlowKey {
    fn eq(&self, other: &Self) -> bool {
        self.canonical() == other.canonical()
    }
}

impl Eq for FlowKey {}

impl Hash for FlowKey {
    fn hash<H: Hasher>(&self, state: &mut H) {
        self.canonical().hash(state);
    }
}
```

**Step 4: Run test to verify pass**

Run: `cargo test --package bondlink-core --test flow_key`
Expected: PASS

**Step 5: Commit**

```bash
git add native/crates/bondlink-core/
git commit -m "feat(core): add canonical bidirectional flow key"
```

---

## Task 4: Implement scheduler and reordering buffer

**Objective:** Weighted capacity scheduler, unhealthy exclusion, UDP pinning, and bounded reordering.

**Files:**
- Modify: `native/crates/bondlink-core/src/scheduler.rs`
- Modify: `native/crates/bondlink-core/src/reorder.rs`
- Modify: `native/crates/bondlink-core/tests/scheduler.rs`
- Modify: `native/crates/bondlink-core/tests/reorder.rs`

**Step 1: Write failing scheduler test**

```rust
// native/crates/bondlink-core/tests/scheduler.rs
use bondlink_core::scheduler::{Scheduler, PathState};

#[test]
fn weighted_distribution() {
    let mut sched = Scheduler::new();
    sched.update_path(0, PathState { healthy: true, estimated_kbps: 1000, rtt_ms: 20.0 });
    sched.update_path(1, PathState { healthy: true, estimated_kbps: 500, rtt_ms: 40.0 });
    let mut counts = [0usize; 2];
    for _ in 0..300 {
        let path = sched.select_path(0).unwrap();
        counts[path] += 1;
    }
    assert!(counts[0] > counts[1]);
    assert!(counts[1] > 0);
}

#[test]
fn unhealthy_path_excluded() {
    let mut sched = Scheduler::new();
    sched.update_path(0, PathState { healthy: true, estimated_kbps: 1000, rtt_ms: 20.0 });
    sched.update_path(1, PathState { healthy: false, estimated_kbps: 500, rtt_ms: 40.0 });
    for _ in 0..100 {
        assert_eq!(sched.select_path(0).unwrap(), 0);
    }
}
```

**Step 2: Run test to verify failure**

Run: `cargo test --package bondlink-core --test scheduler`
Expected: FAIL — "unresolved import"

**Step 3: Implement scheduler**

```rust
// native/crates/bondlink-core/src/scheduler.rs
#[derive(Debug, Clone)]
pub struct PathState {
    pub healthy: bool,
    pub estimated_kbps: u64,
    pub rtt_ms: f64,
}

pub struct Scheduler {
    paths: Vec<Option<PathState>>,
}

impl Scheduler {
    pub fn new() -> Self { Self { paths: Vec::new() } }

    pub fn update_path(&mut self, id: usize, state: PathState) {
        if id >= self.paths.len() {
            self.paths.resize_with(id + 1, || None);
        }
        self.paths[id] = Some(state);
    }

    pub fn select_path(&self, _flow: u64) -> Option<usize> {
        let healthy: Vec<(usize, u64)> = self.paths.iter().enumerate()
            .filter_map(|(i, p)| p.as_ref().filter(|s| s.healthy).map(|s| (i, s.estimated_kbps)))
            .collect();
        if healthy.is_empty() { return None; }
        let total: u64 = healthy.iter().map(|(_, kbps)| kbps).sum();
        if total == 0 { return Some(healthy[0].0); }
        let mut accumulator = 0u64;
        let target = rand::random::<u64>() % total;
        for (i, kbps) in &healthy {
            accumulator += kbps;
            if target < accumulator { return Some(*i); }
        }
        Some(healthy.last().unwrap().0)
    }
}
```

**Step 4: Run test to verify pass**

Run: `cargo test --package bondlink-core --test scheduler`
Expected: PASS

**Step 5: Commit**

```bash
git add native/crates/bondlink-core/
git commit -m "feat(core): add weighted scheduler with unhealthy exclusion"
```

---

## Task 5: Implement reordering buffer

**Objective:** Bounded reordering with duplicate detection, gap handling, and memory limits.

**Files:**
- Modify: `native/crates/bondlink-core/src/reorder.rs`
- Modify: `native/crates/bondlink-core/tests/reorder.rs`

**Step 1: Write failing reorder test**

```rust
// native/crates/bondlink-core/tests/reorder.rs
use bondlink_core::reorder::ReorderBuffer;

#[test]
fn in_order_delivery() {
    let mut buf = ReorderBuffer::new(256, 64 * 1024 * 1024);
    assert!(buf.insert(1, b"a").is_empty());
    assert_eq!(buf.insert(2, b"b").len(), 2);
}

#[test]
fn out_of_order_held_until_gap_filled() {
    let mut buf = ReorderBuffer::new(256, 64 * 1024 * 1024);
    assert!(buf.insert(2, b"b").is_empty());
    assert_eq!(buf.insert(1, b"a").len(), 2);
}

#[test]
fn duplicate_rejected() {
    let mut buf = ReorderBuffer::new(256, 64 * 1024 * 1024);
    assert!(buf.insert(1, b"a").is_empty());
    assert!(buf.insert(1, b"a").is_empty());
    assert_eq!(buf.drain_ready().len(), 1);
}
```

**Step 2: Run test to verify failure**

Run: `cargo test --package bondlink-core --test reorder`
Expected: FAIL — "unresolved import"

**Step 3: Implement reorder buffer**

```rust
// native/crates/bondlink-core/src/reorder.rs
use std::collections::BTreeMap;

pub struct ReorderBuffer {
    max_packets: usize,
    max_memory: usize,
    next_expected: u64,
    buffer: BTreeMap<u64, Vec<u8>>,
    current_memory: usize,
}

impl ReorderBuffer {
    pub fn new(max_packets: usize, max_memory: usize) -> Self {
        Self {
            max_packets,
            max_memory,
            next_expected: 0,
            buffer: BTreeMap::new(),
            current_memory: 0,
        }
    }

    pub fn insert(&mut self, seq: u64, data: &[u8]) -> Vec<(u64, Vec<u8>)> {
        if seq < self.next_expected || self.buffer.contains_key(&seq) {
            return self.drain_ready();
        }
        if self.buffer.len() >= self.max_packets || self.current_memory + data.len() > self.max_memory {
            return self.drain_ready();
        }
        self.current_memory += data.len();
        self.buffer.insert(seq, data.to_vec());
        self.drain_ready()
    }

    fn drain_ready(&mut self) -> Vec<(u64, Vec<u8>)> {
        let mut ready = Vec::new();
        while let Some(data) = self.buffer.remove(&self.next_expected) {
            self.current_memory -= data.len();
            ready.push((self.next_expected, data));
            self.next_expected += 1;
        }
        ready
    }
}
```

**Step 4: Run test to verify pass**

Run: `cargo test --package bondlink-core --test reorder`
Expected: PASS

**Step 5: Commit**

```bash
git add native/crates/bondlink-core/
git commit -m "feat(core): add bounded reordering buffer"
```

---

## Task 6: Implement bondlink-service state machine

**Objective:** Service lifecycle state machine with legal transitions and refusal of illegal ones.

**Files:**
- Create: `native/crates/bondlink-service/src/lib.rs`
- Create: `native/crates/bondlink-service/src/state_machine.rs`
- Create: `native/crates/bondlink-service/tests/state_machine.rs`

**Step 1: Write failing state machine test**

```rust
// native/crates/bondlink-service/tests/state_machine.rs
use bondlink_service::state_machine::{ServiceState, StateTransition};

#[test]
fn legal_transitions() {
    assert!(ServiceState::Idle.can_transition(StateTransition::Configure));
    assert!(ServiceState::Configured.can_transition(StateTransition::Connect));
    assert!(ServiceState::Connected.can_transition(StateTransition::Disconnect));
    assert!(ServiceState::Failed.can_transition(StateTransition::Reset));
}

#[test]
fn illegal_transitions_refused() {
    assert!(!ServiceState::Idle.can_transition(StateTransition::Disconnect));
    assert!(!ServiceState::Connected.can_transition(StateTransition::Configure));
}
```

**Step 2: Run test to verify failure**

Run: `cargo test --package bondlink-service`
Expected: FAIL — "unresolved import"

**Step 3: Implement state machine**

```rust
// native/crates/bondlink-service/src/state_machine.rs
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ServiceState {
    Idle,
    Configured,
    Connecting,
    Connected,
    Disconnected,
    Failed,
}

#[derive(Debug, Clone, Copy)]
pub enum StateTransition {
    Configure,
    Connect,
    ConnectionEstablished,
    Disconnect,
    Fail,
    Reset,
}

impl ServiceState {
    pub fn can_transition(&self, transition: StateTransition) -> bool {
        matches!(
            (self, transition),
            (Self::Idle, StateTransition::Configure)
                | (Self::Configured, StateTransition::Connect)
                | (Self::Connecting, StateTransition::ConnectionEstablished)
                | (Self::Connecting, StateTransition::Fail)
                | (Self::Connected, StateTransition::Disconnect)
                | (Self::Connected, StateTransition::Fail)
                | (Self::Disconnected, StateTransition::Connect)
                | (Self::Disconnected, StateTransition::Reset)
                | (Self::Failed, StateTransition::Reset)
        )
    }

    pub fn transition(&mut self, transition: StateTransition) -> bool {
        if self.can_transition(transition) {
            *self = match (self, transition) {
                (Self::Idle, StateTransition::Configure) => Self::Configured,
                (Self::Configured, StateTransition::Connect) => Self::Connecting,
                (Self::Connecting, StateTransition::ConnectionEstablished) => Self::Connected,
                (_, StateTransition::Fail) => Self::Failed,
                (_, StateTransition::Disconnect) => Self::Disconnected,
                (_, StateTransition::Reset) => Self::Idle,
                _ => return false,
            };
            true
        } else {
            false
        }
    }
}
```

**Step 4: Run test to verify pass**

Run: `cargo test --package bondlink-service`
Expected: PASS

**Step 5: Commit**

```bash
git add native/crates/bondlink-service/
git commit -m "feat(service): add lifecycle state machine with legal transitions"
```

---

## Task 7: Implement Oracle relay installer

**Objective:** Linux shell script that installs TUN, nftables, and QUIC relay on Oracle Cloud.

**Files:**
- Create: `native/crates/bondlink-relay/install.sh`
- Create: `native/crates/bondlink-relay/src/main.rs`

**Step 1: Create relay installer script**

```bash
#!/usr/bin/env bash
# Oracle Cloud Always Free relay installer for BondLink v1
set -euo pipefail

RELAY_PORT=8443
TUN_DEVICE=bondlink0
TUN_SUBNET=10.73.0.0/24
TUN_CLIENT_IP=10.73.0.2
TUN_RELAY_IP=10.73.0.1

echo "[BondLink Relay] Detecting architecture..."
ARCH=$(uname -m)
case "$ARCH" in
    x86_64)  RELAY_BIN="bondlink-relay-x86_64-unknown-linux-gnu" ;;
    aarch64) RELAY_BIN="bondlink-relay-aarch64-unknown-linux-gnu" ;;
    *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
esac
echo "[BondLink Relay] Architecture: $ARCH"

echo "[BondLink Relay] Installing dependencies..."
apt-get update -qq
apt-get install -y -qq iproute2 iptables nftables

echo "[BondLink Relay] Enabling IP forwarding..."
sysctl -w net.ipv4.ip_forward=1
echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf

echo "[BondLink Relay] Configuring nftables..."
nft -f - <<EOF
table inet bondlink {
    chain postrouting {
        type nat hook postrouting priority srcnat; policy accept;
        oifname != "$TUN_DEVICE" masquerade
    }
    chain forward {
        type filter hook forward priority filter; policy drop;
        iifname "$TUN_DEVICE" oifname != "$TUN_DEVICE" accept
        iifname != "$TUN_DEVICE" oifname "$TUN_DEVICE" ct state established,related accept
    }
}
EOF

echo "[BondLink Relay] Creating TUN device..."
ip tuntap add mode tun dev "$TUN_DEVICE"
ip addr add "$TUN_RELAY_IP/24" dev "$TUN_DEVICE"
ip link set "$TUN_DEVICE" up

echo "[BondLink Relay] Detecting public egress IP..."
PUBLIC_IP=$(curl -s https://api.ipify.org)
echo "[BondLink Relay] Public egress: $PUBLIC_IP"

echo "[BondLink Relay] Relay ready on UDP :$RELAY_PORT"
echo "[BondLink Relay] Client tunnel IP: $TUN_CLIENT_IP"
echo "[BondLink Relay] Relay tunnel IP: $TUN_RELAY_IP"
```

**Step 2: Commit**

```bash
git add native/crates/bondlink-relay/
git commit -m "feat(relay): add Oracle Cloud relay installer"
```

---

## Task 8: Build and verify full workspace

**Objective:** Ensure all crates compile, tests pass, and clippy is clean.

**Step 1: Run full workspace build**

Run: `cargo build --workspace`
Expected: PASS

**Step 2: Run all tests**

Run: `cargo test --workspace`
Expected: PASS

**Step 3: Run clippy**

Run: `cargo clippy --workspace --all-targets -- -D warnings`
Expected: PASS

**Step 4: Commit**

```bash
git add -A
git commit -m "build: verify full workspace compiles and tests pass"
```

---

## Task 9: Update UI to reflect native bonding

**Objective:** Update the React UI to show native bonding status, path metrics, and relay info.

**Files:**
- Modify: `src/components/NetworkInterfacesPanel.tsx`
- Modify: `src/components/SpeedTestEngine.tsx`
- Create: `src/components/BondingStatusPanel.tsx`

**Step 1: Add bonding status panel**

```tsx
// src/components/BondingStatusPanel.tsx
import React from 'react';
import { Activity, Shield, Zap, Wifi, Cable } from 'lucide-react';
import { Language } from '../types';

interface BondingStatusPanelProps {
  language: Language;
  isConnected: boolean;
  pathMetrics: {
    ethernet: { rttMs: number; lossPercent: number; kbps: number };
    wifi: { rttMs: number; lossPercent: number; kbps: number };
  };
  relayIp: string;
  egressIp: string;
}

export const BondingStatusPanel: React.FC<BondingStatusPanelProps> = ({
  language, isConnected, pathMetrics, relayIp, egressIp
}) => {
  const isAr = language === 'ar';
  return (
    <div className="rounded-3xl border border-slate-800/80 bg-slate-900/50 p-6 backdrop-blur-xl">
      <h3 className="text-sm font-bold text-white mb-4">
        {isAr ? 'حالة الدمج الأصلي' : 'Native Bonding Status'}
      </h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl bg-slate-950/60 p-4">
          <div className="text-xs text-slate-400">{isAr ? 'حالة الاتصال' : 'Connection'}</div>
          <div className={`text-lg font-bold ${isConnected ? 'text-emerald-400' : 'text-red-400'}`}>
            {isConnected ? (isAr ? 'متصل' : 'Connected') : (isAr ? 'غير متصل' : 'Disconnected')}
          </div>
        </div>
        <div className="rounded-2xl bg-slate-950/60 p-4">
          <div className="text-xs text-slate-400">{isAr ? 'عنوان الخروج' : 'Egress IP'}</div>
          <div className="text-lg font-bold text-cyan-400 font-mono">{egressIp}</div>
        </div>
      </div>
    </div>
  );
};
```

**Step 2: Commit**

```bash
git add src/components/BondingStatusPanel.tsx
git commit -m "feat(ui): add native bonding status panel"
```

---

## Task 10: Final verification and PR

**Objective:** Run all verification, push, and open implementation PR.

**Step 1: Run all verification**

Run: `cargo fmt --all -- --check && cargo clippy --workspace --all-targets -- -D warnings && cargo test --workspace && npm run lint && npm run build`
Expected: PASS

**Step 2: Push and open PR**

```bash
git push -u origin feat/bondlink-v1-native-bonding
gh pr create --base main --head feat/bondlink-v1-native-bonding --title "feat: implement BondLink v1 native bonding" --body "..."
```

**Step 3: Report PR URL**

---

## Verification gates

- [ ] All Rust tests pass
- [ ] Clippy clean with `-D warnings`
- [ ] TypeScript lint passes
- [ ] Production build succeeds
- [ ] No hardcoded secrets
- [ ] No personal network identifiers
- [ ] ADR-001 remains Proposed until planning PR merged
