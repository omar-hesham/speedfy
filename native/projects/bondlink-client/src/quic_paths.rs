use anyhow::Result;
use quinn::{ClientConfig, Endpoint, Connection, RecvStream, SendStream};
use rustls::pki_types::CertificateDer;
use std::net::{SocketAddr, IpAddr, Ipv4Addr};
use std::sync::Arc;
use tokio::net::UdpSocket;
use tracing::{info, warn};

pub struct QuicPath {
    pub name: String,
    pub local_addr: SocketAddr,
    pub remote_addr: SocketAddr,
    pub connection: Option<Connection>,
}

impl QuicPath {
    pub fn new(name: &str, local_ip: IpAddr, remote_addr: SocketAddr) -> Self {
        Self {
            name: name.to_string(),
            local_addr: SocketAddr::new(local_ip, 0),
            remote_addr,
            connection: None,
        }
    }

    pub async fn connect(&mut self, cert_der: &[u8]) -> Result<()> {
        info!("[{}] Connecting from {} to {}", self.name, self.local_addr, self.remote_addr);

        // Create UDP socket bound to specific interface
        let socket = UdpSocket::bind(self.local_addr).await?;
        
        // Set interface binding for Windows
        let local_ip = self.local_addr.ip();
        if local_ip.is_ipv4() {
            let interface_index = 0; // Will be set based on interface
            unsafe {
                let socket_ref = socket.as_raw_fd();
                let ip = match local_ip {
                    IpAddr::V4(v4) => v4.octets(),
                    _ => [0, 0, 0, 0],
                };
                // IP_UNICAST_IF = 31
                let ret = setsockopt(
                    socket_ref,
                    IPPROTO_IP as i32,
                    31, // IP_UNICAST_IF
                    ip.as_ptr() as *const c_void,
                    4,
                );
                if ret != 0 {
                    warn!("[{}] Failed to set IP_UNICAST_IF: {}", self.name, WSAGetLastError());
                }
            }
        }

        // Build client config
        let client_config = build_client_config(cert_der)?;

        // Create endpoint
        let mut endpoint = Endpoint::new(Default::default(), None, socket, Arc::new(client_config))?;

        // Connect
        let connection = endpoint.connect(self.remote_addr, "bondlink.local")?.await?;
        
        self.connection = Some(connection);
        info!("[{}] Connected successfully", self.name);
        Ok(())
    }

    pub async fn send_datagram(&self, data: &[u8]) -> Result<()> {
        if let Some(ref conn) = self.connection {
            conn.send_datagram(data.to_vec().into())?;
            Ok(())
        } else {
            Err(anyhow::anyhow!("[{}] No connection", self.name))
        }
    }

    pub async fn recv_datagram(&self) -> Result<Vec<u8>> {
        if let Some(ref conn) = self.connection {
            let data = conn.read_datagram().await?;
            Ok(data.to_vec())
        } else {
            Err(anyhow::anyhow!("[{}] No connection", self.name))
        }
    }
}

fn build_client_config(cert_der: &[u8]) -> Result<ClientConfig> {
    let cert = CertificateDer::from(cert_der.to_vec());
    let mut root_store = rustls::RootCertStore::new();
    root_store.add(cert)?;
    let client_config = rustls::ClientConfig::builder()
        .with_root_certificates(Arc::new(root_store))
        .with_no_client_auth();
    Ok(ClientConfig::new(Arc::new(client_config)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn path_config() {
        let path = QuicPath::new("eth", IpAddr::V4(Ipv4Addr::new(192, 168, 8, 20)), "84.8.105.228:8443".parse().unwrap());
        assert_eq!(path.name, "eth");
        assert_eq!(path.local_addr.port(), 0);
    }
}
