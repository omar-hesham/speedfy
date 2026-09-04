use anyhow::Result;
use std::net::{IpAddr, Ipv4Addr, SocketAddr, UdpSocket};
use tracing::{info, warn};

pub struct PathSocket {
    pub name: String,
    pub local_ip: IpAddr,
    pub socket: UdpSocket,
    pub remote: SocketAddr,
}

impl PathSocket {
    pub fn new(name: &str, local_ip: IpAddr, remote: SocketAddr) -> Result<Self> {
        let socket = UdpSocket::bind(SocketAddr::new(local_ip, 0))?;

        Ok(Self {
            name: name.to_string(),
            local_ip,
            socket,
            remote,
        })
    }

    pub fn send(&self, data: &[u8]) -> Result<usize> {
        Ok(self.socket.send_to(data, self.remote)?)
    }

    pub fn recv(&self, buf: &mut [u8]) -> Result<(usize, SocketAddr)> {
        Ok(self.socket.recv_from(buf)?)
    }

    pub fn local_addr(&self) -> Result<SocketAddr> {
        Ok(self.socket.local_addr()?)
    }
}

/// Create dual paths for Ethernet and Wi-Fi
pub fn create_dual_paths(relay_addr: SocketAddr) -> Result<Vec<PathSocket>> {
    let mut paths = Vec::new();

    // Ethernet path
    let ethernet_ip = IpAddr::V4(Ipv4Addr::new(192, 168, 8, 20));
    match PathSocket::new("ethernet", ethernet_ip, relay_addr) {
        Ok(path) => {
            info!("Ethernet path: {} -> {}", path.local_addr()?, relay_addr);
            paths.push(path);
        }
        Err(e) => warn!("Failed to create ethernet path: {}", e),
    }

    // Wi-Fi path
    let wifi_ip = IpAddr::V4(Ipv4Addr::new(192, 168, 1, 22));
    match PathSocket::new("wifi", wifi_ip, relay_addr) {
        Ok(path) => {
            info!("Wi-Fi path: {} -> {}", path.local_addr()?, relay_addr);
            paths.push(path);
        }
        Err(e) => warn!("Failed to create Wi-Fi path: {}", e),
    }

    Ok(paths)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dual_paths_config() {
        let relay = "127.0.0.1:8443".parse().unwrap();
        let ethernet_ip = IpAddr::V4(Ipv4Addr::new(192, 168, 8, 20));
        let path = PathSocket::new("test", ethernet_ip, relay);
        assert!(path.is_ok());
    }
}
