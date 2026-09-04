use std::path::PathBuf;

#[derive(Debug, Clone)]
pub struct ServiceConfig {
    pub relay_host: String,
    pub relay_port: u16,
    pub tun_subnet: String,
    pub client_tun_ip: String,
    pub relay_tun_ip: String,
    pub enrollment_code: String,
    pub certificate_pin: String,
    pub log_path: PathBuf,
    pub ipc_pipe_path: PathBuf,
}

impl Default for ServiceConfig {
    fn default() -> Self {
        Self {
            relay_host: String::new(),
            relay_port: 8443,
            tun_subnet: "10.73.0.0/24".to_string(),
            client_tun_ip: "10.73.0.2".to_string(),
            relay_tun_ip: "10.73.0.1".to_string(),
            enrollment_code: String::new(),
            certificate_pin: String::new(),
            log_path: PathBuf::from("logs/bondlink-service.log"),
            ipc_pipe_path: PathBuf::from(r"\\.\pipe\bondlink-service"),
        }
    }
}

impl ServiceConfig {
    pub fn validate(&self) -> Result<(), String> {
        if self.relay_host.is_empty() {
            return Err("relay_host is required".to_string());
        }
        if self.enrollment_code.is_empty() {
            return Err("enrollment_code is required".to_string());
        }
        if self.certificate_pin.is_empty() {
            return Err("certificate_pin is required".to_string());
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_config_has_required_defaults() {
        let config = ServiceConfig::default();
        assert_eq!(config.relay_port, 8443);
        assert_eq!(config.tun_subnet, "10.73.0.0/24");
    }

    #[test]
    fn validate_rejects_empty_relay_host() {
        let config = ServiceConfig::default();
        assert!(config.validate().is_err());
    }

    #[test]
    fn validate_accepts_complete_config() {
        let config = ServiceConfig {
            relay_host: "203.0.113.10".to_string(),
            enrollment_code: "test-code-123".to_string(),
            certificate_pin: "sha256:abcdef1234567890".to_string(),
            ..Default::default()
        };
        assert!(config.validate().is_ok());
    }
}
