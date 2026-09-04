use bondlink_client::ClientConfig;

fn main() {
    println!("BondLink Client v0.1.0 — Windows Native Bonding");
    println!("==============================================\n");

    let config = ClientConfig::default();

    match config.validate() {
        Ok(()) => println!("Config validation: PASS\n"),
        Err(e) => {
            println!("Config validation: FAIL — {}\n", e);
            return;
        }
    }

    println!("Relay: {}", config.relay_addr);
    println!("TUN Adapter: {}", config.tun_adapter_name);
    println!("TUN Subnet: {}", config.tun_subnet);
    println!("Client IP: {}", config.client_tun_ip);
    println!("Relay IP: {}", config.relay_tun_ip);
    println!("MTU: {}", config.mtu);

    println!("\nNext: Wintun adapter + QUIC paths + packet pump.");
}
