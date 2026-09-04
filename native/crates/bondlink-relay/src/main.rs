use bondlink_relay::RelayConfig;
use std::path::PathBuf;

fn main() {
    println!("BondLink Relay v0.1.0 — Windows VPS");
    println!("==================================\n");

    let config = RelayConfig {
        relay_port: 8443,
        tun_adapter_name: "BondLinkRelay".to_string(),
        tun_tunnel_name: "BondLink Relay Tunnel".to_string(),
        tun_subnet: "10.73.0.0/24".to_string(),
        client_tun_ip: "10.73.0.2".to_string(),
        relay_tun_ip: "10.73.0.1".to_string(),
        cert_path: PathBuf::from(r"C:\ProgramData\BondLink\relay.crt"),
        key_path: PathBuf::from(r"C:\ProgramData\BondLink\relay.key"),
        log_path: PathBuf::from(r"C:\ProgramData\BondLink\relay.log"),
    };

    match config.validate() {
        Ok(()) => println!("Config validation: PASS"),
        Err(e) => println!("Config validation: FAIL — {}", e),
    }

    println!("\nRelay configuration:");
    println!("  Port: {}", config.relay_port);
    println!("  TUN Adapter: {}", config.tun_adapter_name);
    println!("  TUN Subnet: {}", config.tun_subnet);
    println!("  Client IP: {}", config.client_tun_ip);
    println!("  Relay IP: {}", config.relay_tun_ip);
    println!("  Cert: {}", config.cert_path.display());
    println!("  Key: {}", config.key_path.display());

    println!("\nNext: Install as Windows Service + Wintun + QUIC listener.");
}
