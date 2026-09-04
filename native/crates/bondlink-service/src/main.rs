use bondlink_service::{ServiceConfig, ServiceState, StateTransition};
use std::path::PathBuf;

fn main() {
    println!("BondLink v0.1.0 — Windows Native Bonding Service");
    println!("================================================\n");

    // Demonstrate state machine
    let mut state = ServiceState::Idle;
    println!("Initial state: {:?}", state);

    state.transition(StateTransition::Configure);
    println!("After Configure: {:?}", state);

    state.transition(StateTransition::Connect);
    println!("After Connect: {:?}", state);

    state.transition(StateTransition::ConnectionEstablished);
    println!("After ConnectionEstablished: {:?}", state);

    // Demonstrate config validation
    let config = ServiceConfig {
        relay_host: "203.0.113.10".to_string(),
        relay_port: 8443,
        tun_subnet: "10.73.0.0/24".to_string(),
        client_tun_ip: "10.73.0.2".to_string(),
        relay_tun_ip: "10.73.0.1".to_string(),
        enrollment_code: "test-enrollment-code".to_string(),
        certificate_pin: "sha256:abcdef1234567890".to_string(),
        log_path: PathBuf::from("logs/bondlink-service.log"),
        ipc_pipe_path: PathBuf::from(r"\\.\pipe\bondlink-v1"),
    };

    match config.validate() {
        Ok(()) => println!("\nConfig validation: PASS"),
        Err(e) => println!("\nConfig validation: FAIL — {}", e),
    }

    // Show invalid config
    let bad_config = ServiceConfig::default();
    match bad_config.validate() {
        Ok(()) => println!("Default config validation: PASS"),
        Err(e) => println!("Default config validation: FAIL — {}", e),
    }

    println!("\nService skeleton ready.");
    println!("Next: Wintun adapter + QUIC paths + Oracle relay.");
}
