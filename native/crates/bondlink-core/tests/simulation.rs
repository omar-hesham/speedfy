use bondlink_core::flow_key::FlowKey;
use bondlink_core::scheduler::{PathState, Scheduler};
use bondlink_core::reorder::ReorderBuffer;
use std::collections::HashMap;

#[derive(Debug, Clone)]
pub struct SimulatedPath {
    pub id: usize,
    pub state: PathState,
    pub rtt_ms: f64,
    pub loss_percent: f64,
    pub reorder_percent: f64,
}

pub struct Simulation {
    pub scheduler: Scheduler,
    pub reorder_buffers: HashMap<FlowKey, ReorderBuffer>,
    pub paths: Vec<SimulatedPath>,
    pub total_bytes_scheduled: u64,
    pub total_bytes_reordered: u64,
    pub total_drops: u64,
    pub max_memory_used: usize,
}

impl Simulation {
    pub fn new() -> Self {
        Self {
            scheduler: Scheduler::new(),
            reorder_buffers: HashMap::new(),
            paths: Vec::new(),
            total_bytes_scheduled: 0,
            total_bytes_reordered: 0,
            total_drops: 0,
            max_memory_used: 0,
        }
    }

    pub fn add_path(&mut self, id: usize, healthy: bool, kbps: u64, rtt_ms: f64) {
        let state = PathState {
            healthy,
            estimated_kbps: kbps,
            rtt_ms,
        };
        self.scheduler.update_path(id, state.clone());
        self.paths.push(SimulatedPath {
            id,
            state,
            rtt_ms,
            loss_percent: 0.0,
            reorder_percent: 0.0,
        });
    }

    pub fn schedule_packet(&mut self, flow: &FlowKey, data: &[u8]) -> Option<usize> {
        let path_id = self.scheduler.select_path(0)?;
        self.total_bytes_scheduled += data.len() as u64;
        Some(path_id)
    }

    pub fn insert_ordered(&mut self, flow: &FlowKey, seq: u64, data: &[u8]) -> Vec<(u64, Vec<u8>)> {
        let buffer = self.reorder_buffers
            .entry(flow.clone())
            .or_insert_with(|| ReorderBuffer::new(256, 64 * 1024 * 1024));
        let ready = buffer.insert(seq, data);
        self.max_memory_used = self.max_memory_used.max(buffer.memory_used());
        if !ready.is_empty() {
            self.total_bytes_reordered += ready.iter().map(|(_, d)| d.len() as u64).sum::<u64>();
        }
        ready
    }

    pub fn memory_within_bounds(&self) -> bool {
        self.max_memory_used <= 64 * 1024 * 1024
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scheduler_selects_healthy_path() {
        let mut sim = Simulation::new();
        sim.add_path(0, true, 1000, 20.0);
        sim.add_path(1, false, 500, 40.0);

        let flow = FlowKey::new(&[10, 0, 0, 1], &[8, 8, 8, 8], 1234, 80, 6);
        for _ in 0..100 {
            assert_eq!(sim.schedule_packet(&flow, b"test").unwrap(), 0);
        }
    }

    #[test]
    fn scheduler_distributes_by_weight() {
        let mut sim = Simulation::new();
        sim.add_path(0, true, 1000, 20.0);
        sim.add_path(1, true, 500, 40.0);

        let flow = FlowKey::new(&[10, 0, 0, 1], &[8, 8, 8, 8], 1234, 80, 6);
        let mut counts = [0usize; 2];
        for _ in 0..300 {
            let path = sim.schedule_packet(&flow, b"test").unwrap();
            counts[path] += 1;
        }
        assert!(counts[0] > counts[1]);
        assert!(counts[1] > 0);
    }

    #[test]
    fn reorder_in_order_delivery() {
        let mut sim = Simulation::new();
        let flow = FlowKey::new(&[10, 0, 0, 1], &[8, 8, 8, 8], 1234, 80, 6);

        let ready = sim.insert_ordered(&flow, 0, b"a");
        assert_eq!(ready.len(), 1);
        let ready = sim.insert_ordered(&flow, 1, b"b");
        assert_eq!(ready.len(), 1);
    }

    #[test]
    fn reorder_out_of_order_held() {
        let mut sim = Simulation::new();
        let flow = FlowKey::new(&[10, 0, 0, 1], &[8, 8, 8, 8], 1234, 80, 6);

        let ready = sim.insert_ordered(&flow, 2, b"c");
        assert!(ready.is_empty());
        let ready = sim.insert_ordered(&flow, 1, b"b");
        assert!(ready.is_empty());
        let ready = sim.insert_ordered(&flow, 0, b"a");
        assert_eq!(ready.len(), 3);
    }

    #[test]
    fn reorder_bounded_memory() {
        let mut sim = Simulation::new();
        let flow = FlowKey::new(&[10, 0, 0, 1], &[8, 8, 8, 8], 1234, 80, 6);

        for i in 0..1000 {
            sim.insert_ordered(&flow, i, &[0u8; 100]);
        }
        assert!(sim.memory_within_bounds());
    }

    #[test]
    fn reorder_duplicate_rejected() {
        let mut sim = Simulation::new();
        let flow = FlowKey::new(&[10, 0, 0, 1], &[8, 8, 8, 8], 1234, 80, 6);

        let ready = sim.insert_ordered(&flow, 1, b"a");
        assert!(ready.is_empty());
        let ready = sim.insert_ordered(&flow, 1, b"a");
        assert!(ready.is_empty());
    }

    #[test]
    fn failover_when_path_dies() {
        let mut sim = Simulation::new();
        sim.add_path(0, true, 1000, 20.0);
        sim.add_path(1, true, 500, 40.0);

        let flow = FlowKey::new(&[10, 0, 0, 1], &[8, 8, 8, 8], 1234, 80, 6);

        // Both paths healthy
        for _ in 0..10 {
            let _ = sim.schedule_packet(&flow, b"test");
        }

        // Path 0 dies
        sim.scheduler.update_path(0, PathState {
            healthy: false,
            estimated_kbps: 1000,
            rtt_ms: 20.0,
        });

        // All traffic should go to path 1
        for _ in 0..100 {
            assert_eq!(sim.schedule_packet(&flow, b"test").unwrap(), 1);
        }
    }

    #[test]
    fn no_deadlock_under_load() {
        let mut sim = Simulation::new();
        sim.add_path(0, true, 1000, 20.0);
        sim.add_path(1, true, 500, 40.0);

        let flow = FlowKey::new(&[10, 0, 0, 1], &[8, 8, 8, 8], 1234, 80, 6);

        // Send 10000 packets
        for i in 0..10000 {
            let path = sim.schedule_packet(&flow, b"test");
            assert!(path.is_some());
            let _ = sim.insert_ordered(&flow, i, b"test");
        }

        assert!(sim.memory_within_bounds());
        assert!(sim.total_bytes_scheduled > 0);
    }
}
