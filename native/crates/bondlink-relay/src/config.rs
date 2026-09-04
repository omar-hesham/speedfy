use std::path::PathBuf;

#[derive(Debug, Clone)]
pub struct RelayConfig {
    pub relay_port: u16,
    pub tun_adapter_name: String,
    pub tun_tunnel_name: String,
    pub tun_subnet: String,
    pub client_tun_ip: String,
    pub relay_tun_ip: String,
    pub cert_path: PathBuf,
    pub key_path: PathBuf,
    pub log_path: PathBuf,
}

impl Default for RelayConfig {
    fn default() -> Self {
        Self {
            relay_port: 8443,
            tun_adapter_name: "BondLinkRelay".to_string(),
            tun_tunnel_name: "BondLink Relay Tunnel".to_string(),
            tun_subnet: "10.73.0.0/24".to_string(),
            client_tun_ip: "10.73.0.2".to_string(),
            relay_tun_ip: "10.73.0.1".to_string(),
            cert_path: PathBuf::from(r"C:\ProgramData\BondLink\relay.crt"),
            key_path: PathBuf::from(r"C:\ProgramData\BondLink\relay.key"),
            log_path: PathBuf::from(r"C:\ProgramData\BondLink\relay.log"),
        }
    }
}

impl RelayConfig {
    pub fn validate(&self) -> Result<(), String> {
        if self.relay_port == 0 {
            return Err("relay_port must be non-zero".to_string());
        }
        if !self.cert_path.exists() {
            return Err(format!(
                "certificate not found: {}",
                self.cert_path.display()
            ));
        }
        if !self.key_path.exists() {
            return Err(format!(
                "private key not found: {}",
                self.key_path.display()
            ));
        }
        Ok(())
    }

    pub fn detect_architecture() -> &'static str {
        match std::env::consts::ARCH {
            "x86_64" => "x86_64",
            "aarch64" => "aarch64",
            other => other,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_config_has_required_defaults() {
        let config = RelayConfig::default();
        assert_eq!(config.relay_port, 8443);
        assert_eq!(config.tun_adapter_name, "BondLinkRelay");
        assert_eq!(config.tun_tunnel_name, "BondLink Relay Tunnel");
        assert_eq!(config.tun_subnet, "10.73.0.0/24");
    }

    #[test]
    fn validate_rejects_missing_cert() {
        let config = RelayConfig::default();
        assert!(config.validate().is_err());
    }

    #[test]
    fn detect_architecture_returns_known_arch() {
        let arch = RelayConfig::detect_architecture();
        assert!(!arch.is_empty());
    }
}
