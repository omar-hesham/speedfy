#[derive(Debug, Clone)]
pub struct PathState {
    pub healthy: bool,
    pub estimated_kbps: u64,
    pub rtt_ms: f64,
}

pub struct Scheduler {
    paths: Vec<Option<PathState>>,
}

impl Default for Scheduler {
    fn default() -> Self {
        Self::new()
    }
}

impl Scheduler {
    pub fn new() -> Self {
        Self { paths: Vec::new() }
    }

    pub fn update_path(&mut self, id: usize, state: PathState) {
        if id >= self.paths.len() {
            self.paths.resize_with(id + 1, || None);
        }
        self.paths[id] = Some(state);
    }

    pub fn select_path(&self, _flow: u64) -> Option<usize> {
        let healthy: Vec<(usize, u64)> = self
            .paths
            .iter()
            .enumerate()
            .filter_map(|(i, p)| p.as_ref().filter(|s| s.healthy).map(|s| (i, s.estimated_kbps)))
            .collect();
        if healthy.is_empty() {
            return None;
        }
        let total: u64 = healthy.iter().map(|(_, kbps)| kbps).sum();
        if total == 0 {
            return Some(healthy[0].0);
        }
        let mut accumulator = 0u64;
        let target = rand::random::<u64>() % total;
        for (i, kbps) in &healthy {
            accumulator += kbps;
            if target < accumulator {
                return Some(*i);
            }
        }
        Some(healthy.last().unwrap().0)
    }

    pub fn healthy_count(&self) -> usize {
        self.paths.iter().filter(|p| p.as_ref().is_some_and(|s| s.healthy)).count()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

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

    #[test]
    fn no_healthy_paths_returns_none() {
        let mut sched = Scheduler::new();
        sched.update_path(0, PathState { healthy: false, estimated_kbps: 1000, rtt_ms: 20.0 });
        assert!(sched.select_path(0).is_none());
    }

    #[test]
    fn empty_scheduler_returns_none() {
        let sched = Scheduler::new();
        assert!(sched.select_path(0).is_none());
    }
}
