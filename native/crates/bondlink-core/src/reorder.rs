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
        if seq < self.next_expected {
            return self.drain_ready();
        }
        if self.buffer.contains_key(&seq) {
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

    pub fn len(&self) -> usize {
        self.buffer.len()
    }

    pub fn is_empty(&self) -> bool {
        self.buffer.is_empty()
    }

    pub fn memory_used(&self) -> usize {
        self.current_memory
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn in_order_delivery() {
        let mut buf = ReorderBuffer::new(256, 64 * 1024 * 1024);
        let ready = buf.insert(0, b"a");
        assert_eq!(ready.len(), 1);
        let ready = buf.insert(1, b"b");
        assert_eq!(ready.len(), 1);
    }

    #[test]
    fn out_of_order_held_then_delivered() {
        let mut buf = ReorderBuffer::new(256, 64 * 1024 * 1024);
        let ready = buf.insert(2, b"c");
        assert!(ready.is_empty());
        let ready = buf.insert(1, b"b");
        assert!(ready.is_empty());
        let ready = buf.insert(0, b"a");
        assert_eq!(ready.len(), 3);
    }

    #[test]
    fn duplicate_rejected() {
        let mut buf = ReorderBuffer::new(256, 64 * 1024 * 1024);
        let _ = buf.insert(1, b"a");
        let _ = buf.insert(1, b"a");
        assert_eq!(buf.len(), 1);
    }

    #[test]
    fn bounded_memory() {
        let mut buf = ReorderBuffer::new(256, 100);
        for i in 0..100 {
            let _ = buf.insert(i, &[0u8; 10]);
        }
        assert!(buf.memory_used() <= 100);
    }

    #[test]
    fn old_packet_below_window_rejected() {
        let mut buf = ReorderBuffer::new(256, 64 * 1024 * 1024);
        let _ = buf.insert(0, b"first");
        let _ = buf.insert(1, b"second");
        let ready = buf.insert(0, b"late");
        assert!(ready.is_empty());
        assert_eq!(buf.len(), 0);
    }
}
