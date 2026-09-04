use bondlink_relay::RelayConfig;
use std::path::PathBuf;

fn main() {
    println!("BondLink Relay v0.1.0 — Oracle Cloud Linux");
    println!("=========================================\n");

    let config = RelayConfig {
        relay_port: 8443,
        tun_device: "bondlink0".to_string(),
        tun_subnet: "10.73.0.0/24".to_string(),
        client_tun_ip: "10.73.0.2".to_string(),
        relay_tun_ip: "10.73.0.1".to_string(),
        cert_path: PathBuf::from("/etc/bondlink/relay.crt"),
        key_path: PathBuf::from("/etc/bondlink/relay.key"),
        log_path: PathBuf::from("/var/log/bondlink/relay.log"),
    };

    match config.validate() {
        Ok(()) => println!("Config validation: PASS"),
        Err(e) => println!("Config validation: FAIL — {}", e),
    }

    println!("\nRelay configuration:");
    println!("  Port: {}", config.relay_port);
    println!("  TUN Device: {}", config.tun_device);
    println!("  TUN Subnet: {}", config.tun_subnet);
    println!("  Client IP: {}", config.client_tun_ip);
    println!("  Relay IP: {}", config.relay_tun_ip);
    println!("  Cert: {}", config.cert_path.display());
    println!("  Key: {}", config.key_path.display());

    println!("\nNext: Install as systemd service + TUN + QUIC listener.");
}
