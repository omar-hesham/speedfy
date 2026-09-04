use std::net::Ipv4Addr;
use std::str::FromStr;

pub struct WintunConfig {
    pub adapter_name: String,
    pub tunnel_name: String,
    pub mtu: u16,
    pub tunnel_ip: Ipv4Addr,
    pub tunnel_netmask: Ipv4Addr,
    pub dns_server: Ipv4Addr,
}

impl Default for WintunConfig {
    fn default() -> Self {
        Self {
            adapter_name: "BondLink".to_string(),
            tunnel_name: "BondLink Tunnel".to_string(),
            mtu: 1280,
            tunnel_ip: Ipv4Addr::from_str("10.73.0.2").unwrap(),
            tunnel_netmask: Ipv4Addr::from_str("255.255.255.0").unwrap(),
            dns_server: Ipv4Addr::from_str("10.73.0.1").unwrap(),
        }
    }
}

pub struct WintunAdapter {
    config: WintunConfig,
}

impl WintunAdapter {
    pub fn new(config: WintunConfig) -> Self {
        Self { config }
    }

    pub fn config(&self) -> &WintunConfig {
        &self.config
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_config_has_expected_values() {
        let config = WintunConfig::default();
        assert_eq!(config.adapter_name, "BondLink");
        assert_eq!(config.tunnel_name, "BondLink Tunnel");
        assert_eq!(config.mtu, 1280);
        assert_eq!(config.tunnel_ip.to_string(), "10.73.0.2");
        assert_eq!(config.tunnel_netmask.to_string(), "255.255.255.0");
        assert_eq!(config.dns_server.to_string(), "10.73.0.1");
    }

    #[test]
    fn custom_config() {
        let config = WintunConfig {
            adapter_name: "Test".to_string(),
            tunnel_name: "Test Tunnel".to_string(),
            mtu: 1000,
            tunnel_ip: Ipv4Addr::from_str("10.74.0.2").unwrap(),
            tunnel_netmask: Ipv4Addr::from_str("255.255.255.0").unwrap(),
            dns_server: Ipv4Addr::from_str("10.74.0.1").unwrap(),
        };
        assert_eq!(config.adapter_name, "Test");
        assert_eq!(config.mtu, 1000);
    }

    #[test]
    fn adapter_stores_config() {
        let config = WintunConfig::default();
        let adapter = WintunAdapter::new(config);
        assert_eq!(adapter.config().adapter_name, "BondLink");
    }
}
