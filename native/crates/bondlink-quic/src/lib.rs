use std::net::SocketAddr;

#[derive(Debug, Clone)]
pub struct QuicConfig {
    pub server_addr: SocketAddr,
    pub bind_addr: SocketAddr,
    pub server_name: String,
}

impl QuicConfig {
    pub fn new(server_addr: SocketAddr, bind_addr: SocketAddr) -> Self {
        Self {
            server_addr,
            bind_addr,
            server_name: "bondlink.local".to_string(),
        }
    }
}

impl Default for QuicConfig {
    fn default() -> Self {
        Self {
            server_addr: "127.0.0.1:8443".parse().unwrap(),
            bind_addr: "0.0.0.0:0".parse().unwrap(),
            server_name: "bondlink.local".to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_config() {
        let config = QuicConfig::default();
        assert_eq!(config.server_name, "bondlink.local");
    }

    #[test]
    fn custom_config() {
        let config = QuicConfig::new(
            "203.0.113.10:8443".parse().unwrap(),
            "192.168.1.100:0".parse().unwrap(),
        );
        assert_eq!(config.server_addr.to_string(), "203.0.113.10:8443");
        assert_eq!(config.bind_addr.to_string(), "192.168.1.100:0");
    }
}
