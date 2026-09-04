use bondlink_service::{ServiceConfig, ServiceState, StateTransition};
use std::path::PathBuf;

fn main() {
    println!("BondLink Client v0.1.0 — Windows Native Bonding");
    println!("==============================================\n");

    let config = ServiceConfig {
        relay_host: "203.0.113.10".to_string(),
        relay_port: 8443,
        tun_subnet: "10.73.0.0/24".to_string(),
        client_tun_ip: "10.73.0.2".to_string(),
        relay_tun_ip: "10.73.0.1".to_string(),
        enrollment_code: "test-enrollment-code".to_string(),
        certificate_pin: "sha256:abcdef1234567890".to_string(),
        log_path: PathBuf::from(r"C:\ProgramData\BondLink\bondlink.log"),
        ipc_pipe_path: PathBuf::from(r"\\.\pipe\bondlink-v1"),
    };

    match config.validate() {
        Ok(()) => println!("Config validation: PASS\n"),
        Err(e) => {
            println!("Config validation: FAIL — {}\n", e);
            return;
        }
    }

    let mut state = ServiceState::Idle;
    println!("State: {:?}", state);

    state.transition(StateTransition::Configure);
    println!("State: {:?}", state);

    state.transition(StateTransition::Connect);
    println!("State: {:?}", state);

    state.transition(StateTransition::ConnectionEstablished);
    println!("State: {:?}", state);

    println!("\nBondLink client ready.");
    println!("Next: Wintun create adapter + QUIC paths + packet pump.");
}
