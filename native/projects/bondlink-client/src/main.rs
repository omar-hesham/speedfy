use bondlink_client::{ClientConfig, wintun_adapter::WintunAdapter, dual_paths::create_dual_paths};
use std::sync::Arc;
use std::sync::Mutex;
use tracing::{info, error};

fn main() {
    tracing_subscriber::fmt::init();
    info!("BondLink Client v0.1.0 — Windows Native Bonding");
    info!("==============================================\n");

    let config = ClientConfig::default();

    match config.validate() {
        Ok(()) => info!("Config validation: PASS\n"),
        Err(e) => {
            error!("Config validation: FAIL — {}", e);
            return;
        }
    };

    info!("Relay: {}", config.relay_addr);
    info!("TUN Adapter: {}", config.tun_adapter_name);
    info!("Client IP: {}", config.client_tun_ip);
    info!("Relay IP: {}", config.relay_tun_ip);
    info!("MTU: {}\n", config.mtu);

    // Create Wintun adapter
    info!("Creating Wintun adapter...");
    let mut adapter = WintunAdapter::new(
        config.tun_adapter_name.clone(),
        config.tun_tunnel_name.clone(),
        config.mtu,
    );

    if let Err(e) = adapter.create_adapter() {
        error!("Failed to create adapter: {}", e);
        return;
    }

    if let Err(e) = adapter.start_session() {
        error!("Failed to start session: {}", e);
        return;
    }

    if let Err(e) = adapter.configure_interface(
        &config.client_tun_ip,
        "255.255.255.0",
        &config.relay_tun_ip,
    ) {
        error!("Failed to configure interface: {}", e);
        return;
    }

    info!("Wintun adapter created and configured\n");

    // Create dual paths
    info!("Creating dual paths...");
    let paths = match create_dual_paths(config.relay_addr) {
        Ok(p) => p,
        Err(e) => {
            error!("Failed to create paths: {}", e);
            return;
        }
    };

    info!("Created {} paths\n", paths.len());

    // Packet pump
    info!("Starting packet pump...");
    let adapter = Arc::new(Mutex::new(adapter));
    let mut buf = vec![0u8; 65536];

    loop {
        // Read from Wintun
        let len = {
            let mut adapter = adapter.lock().unwrap();
            match adapter.read_packet(&mut buf) {
                Ok(0) => continue,
                Ok(n) => n,
                Err(e) => {
                    error!("Read error: {}", e);
                    continue;
                }
            }
        };

        // Send via all paths (for now)
        for path in &paths {
            if let Err(e) = path.send(&buf[..len]) {
                error!("[{}] Send error: {}", path.name, e);
            }
        }
    }
}
