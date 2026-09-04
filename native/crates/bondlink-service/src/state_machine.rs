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
            let current = *self;
            *self = match (current, transition) {
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

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SessionPhase {
    Handshake,
    Enrollment,
    Active,
    Rekeying,
    Closed,
}

#[cfg(test)]
mod tests {
    use super::*;

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

    #[test]
    fn full_lifecycle() {
        let mut state = ServiceState::Idle;
        assert!(state.transition(StateTransition::Configure));
        assert_eq!(state, ServiceState::Configured);
        assert!(state.transition(StateTransition::Connect));
        assert_eq!(state, ServiceState::Connecting);
        assert!(state.transition(StateTransition::ConnectionEstablished));
        assert_eq!(state, ServiceState::Connected);
        assert!(state.transition(StateTransition::Disconnect));
        assert_eq!(state, ServiceState::Disconnected);
        assert!(state.transition(StateTransition::Reset));
        assert_eq!(state, ServiceState::Idle);
    }

    #[test]
    fn failure_path() {
        let mut state = ServiceState::Idle;
        assert!(state.transition(StateTransition::Configure));
        assert!(state.transition(StateTransition::Connect));
        assert!(state.transition(StateTransition::Fail));
        assert_eq!(state, ServiceState::Failed);
        assert!(state.transition(StateTransition::Reset));
        assert_eq!(state, ServiceState::Idle);
    }
}
