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
    pub fn new(
        src_ip: &[u8; 4],
        dst_ip: &[u8; 4],
        src_port: u16,
        dst_port: u16,
        protocol: u8,
    ) -> Self {
        Self {
            src_ip: *src_ip,
            dst_ip: *dst_ip,
            src_port,
            dst_port,
            protocol,
        }
    }

    pub fn canonical(&self) -> ([u8; 6], [u8; 6], u8) {
        let mut a = [0u8; 6];
        let mut b = [0u8; 6];
        a[..4].copy_from_slice(&self.src_ip);
        a[4..6].copy_from_slice(&self.src_port.to_be_bytes());
        b[..4].copy_from_slice(&self.dst_ip);
        b[4..6].copy_from_slice(&self.dst_port.to_be_bytes());
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bidirectional_flow_identity() {
        let a = FlowKey::new(&[192, 168, 1, 100], &[8, 8, 8, 8], 54321, 443, 6);
        let b = FlowKey::new(&[8, 8, 8, 8], &[192, 168, 1, 100], 443, 54321, 6);
        assert_eq!(a.canonical(), b.canonical());
    }

    #[test]
    fn different_protocols_are_distinct() {
        let tcp = FlowKey::new(&[10, 0, 0, 1], &[10, 0, 0, 2], 1234, 80, 6);
        let udp = FlowKey::new(&[10, 0, 0, 1], &[10, 0, 0, 2], 1234, 80, 17);
        assert_ne!(tcp.canonical(), udp.canonical());
    }

    #[test]
    fn same_ports_different_ips_are_distinct() {
        let a = FlowKey::new(&[10, 0, 0, 1], &[10, 0, 0, 2], 80, 443, 6);
        let b = FlowKey::new(&[10, 0, 0, 1], &[10, 0, 0, 3], 80, 443, 6);
        assert_ne!(a.canonical(), b.canonical());
    }
}
