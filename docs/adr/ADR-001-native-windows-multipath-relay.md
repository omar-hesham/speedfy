# ADR-001: Native Windows multipath tunnel through a Windows VPS relay

- **Status:** Proposed
- **Decision owner:** Omar
- **Promotion condition:** Becomes Accepted only after the planning change is reviewed and merged
- **Scope:** BondLink v1 system architecture
- **Authoritative specification:** [BondLink v1 Master Implementation Prompt](../BONDLINK_V1_MASTER_IMPLEMENTATION_PROMPT.md)

## Context

BondLink must carry all supported Windows IPv4 traffic across Ethernet and Wi-Fi, aggregate eligible traffic, survive path loss, and expose one public IPv4 from a user-owned Windows VPS. The user explicitly rejected a required OpenWrt router, WSL instance, or client-side Linux VM. The relay must also run Windows because the user's VPS is Windows.

The current prototype distributes new proxy sockets and includes metric-tuning/OpenMPTCProuter templates. None provides the required native, full-tunnel Windows product boundary.

## Decision

Adopt a **client–relay software-defined bonding gateway**:

1. A privileged Rust Windows Service running as LocalSystem captures/injects IPv4 through Wintun and activates only the privileges needed for each operation.
2. The service creates one QUIC connection per physical Internet path using a UDP socket with an explicit relay `/32` route, `IP_UNICAST_IF`, and source-address binding.
3. Reliable QUIC streams carry session control; QUIC DATAGRAM carries inner IPv4 packets using a negotiated 1000..1280-byte tunnel MTU.
4. A shared Rust core performs canonical bidirectional flow classification, mode-specific scheduling, bounded per-flow reordering, health detection, and metrics.
5. A Rust Windows Service relay on the user's Windows VPS terminates both paths, exchanges packets with a Wintun adapter, runs the tunnel DNS forwarding boundary, and uses Windows NAT/routing for one public egress IPv4.
6. An unprivileged React/Tauri UI and CLI communicate with the service through an ACL-protected local named pipe.
7. Route, DNS, firewall, IPv6-block, and adapter changes are managed as an ordered, journaled, reversible transaction; relay host routes are verified before the virtual default route.

## Why this decision

- Wintun satisfies the native Windows Layer-3 capture boundary on both client and relay.
- Independent QUIC connections allow explicit binding to different Windows interfaces while reusing a mature encrypted transport and per-path congestion control.
- QUIC DATAGRAM avoids TCP-over-TCP retransmission while carrying both inner TCP and UDP.
- A remote Windows VPS relay is necessary to present one public egress IP and reconstruct the virtual tunnel.
- Rust supports both the Windows x64 client and the Windows x64/ARM64 relay from one core codebase.

## Modes and product semantics

- `balanced`: aggregates eligible bulk TCP while pinning short/UDP flows.
- `aggregate`: more aggressive TCP striping; still no universal 100% throughput promise.
- `low-latency`: pins each flow to the best healthy path and prioritizes failover; no aggregation or lower-ping claim for a single game flow.

"All traffic supported" means that TCP, UDP, ICMP, and DNS can traverse the virtual IPv4 tunnel. It does not mean every flow is striped across both links.

## Alternatives considered

### A. Local HTTP/SOCKS proxy

**Rejected as the primary architecture.** It only affects proxy-aware applications and distributes distinct sockets. Keep it, if retained at all, as a diagnostic/legacy mode clearly separated from true tunnel bonding.

### B. Equal Windows interface metrics

**Rejected.** It neither creates one remote egress nor guarantees safe aggregation of host traffic. Metric changes alone must not be marketed as bonding.

### C. OpenMPTCProuter/OpenWrt or client Linux VM

**Rejected for v1 product delivery.** It is a valid proof/reference system but violates the native-Windows, one-click, no-VM constraint.

### D. Linux kernel MPTCP end to end

**Rejected for the Windows client.** The target client is not a Linux MPTCP endpoint, and MPTCP alone does not carry arbitrary inner UDP/game traffic.

### E. Two WireGuard tunnels plus Windows routing

**Rejected as sufficient by itself.** WireGuard secures paths, but two independent tunnels do not provide the logical session, flow scheduler, bounded reorder behavior, and one-flow aggregation contract required here.

### F. Custom raw UDP plus custom cryptography

**Rejected.** Building cryptographic primitives or a new handshake is unnecessary and raises avoidable security risk. Any remaining BondLink envelope is application framing inside authenticated QUIC.

### G. Linux relay on the Oracle VPS

**Rejected.** The user's VPS is Windows. The relay must also run Windows to match the deployed environment.

## Consequences

### Positive

- Native Windows UX with one virtual interface.
- One public egress IPv4 from the Windows VPS.
- One data-plane codebase across all Windows architectures.
- Mode-specific behavior that can be tested and described honestly.
- Existing React UI can be retained after technical claims and privileged boundaries are corrected.

### Negative

- This is a networking systems product, not a small extension to the current Node prototype.
- Wintun, Windows routing, crash recovery, and installer signing require privileged integration testing on both client and relay.
- Packet striping across asymmetric paths can increase reorder delay and harm inner TCP.
- UDP/game traffic cannot be promised both lowest latency and bandwidth aggregation.
- The Windows VPS public throughput may cap below the combined home links depending on the VPS provider/shape.

### Operational

- Windows VPS type must be discovered by the relay doctor; no architecture assumption is allowed.
- VPS ingress configuration remains a manual, explicitly approved action.
- Windows client and relay release artifacts must be signed and independently built for their targets.

## Required validation before acceptance

The decision remains Proposed until the five disposable spikes in the Master Implementation Prompt pass:

1. Wintun, ordered interface-pinned routing, leak policy, and crash-safe restoration.
2. Two simultaneous interface-pinned QUIC DATAGRAM paths plus MTU/backpressure negotiation.
3. Windows VPS relay capacity and architecture measurement.
4. Deterministic bidirectional scheduler/reorder impairment simulation.
5. DNS and IPv6 leak-boundary verification.

Failure of a spike requires revisiting this ADR rather than silently changing the implementation.
