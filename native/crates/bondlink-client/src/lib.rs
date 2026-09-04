use anyhow::Result;
use std::net::SocketAddr;

pub const RELAY_HOST: &str = "84.8.105.228";
pub const RELAY_PORT: u16 = 8443;

pub struct ClientConfig {
    pub relay_addr: SocketAddr,
    pub tun_adapter_name: String,
    pub tun_tunnel_name: String,
    pub tun_subnet: String,
    pub client_tun_ip: String,
    pub relay_tun_ip: String,
    pub mtu: u16,
}

impl Default for ClientConfig {
    fn default() -> Self {
        Self {
            relay_addr: format!("{}:{}", RELAY_HOST, RELAY_PORT).parse().unwrap(),
            tun_adapter_name: "BondLink".to_string(),
            tun_tunnel_name: "BondLink Tunnel".to_string(),
            tun_subnet: "10.73.0.0/24".to_string(),
            client_tun_ip: "10.73.0.2".to_string(),
            relay_tun_ip: "10.73.0.1".to_string(),
            mtu: 1280,
        }
    }
}

impl ClientConfig {
    pub fn validate(&self) -> Result<(), String> {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_config_has_expected_values() {
        let config = ClientConfig::default();
        assert_eq!(config.relay_addr.to_string(), "84.8.105.228:8443");
        assert_eq!(config.tun_adapter_name, "BondLink");
        assert_eq!(config.client_tun_ip, "10.73.0.2");
        assert_eq!(config.mtu, 1280);
    }
}
