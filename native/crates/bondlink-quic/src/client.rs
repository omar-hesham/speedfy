use quinn::{Connection, Endpoint};

use crate::config::QuicConfig;

pub struct QuicClient {
    config: QuicConfig,
    endpoint: Option<Endpoint>,
}

impl QuicClient {
    pub fn new(config: QuicConfig) -> Self {
        Self {
            config,
            endpoint: None,
        }
    }

    pub fn config(&self) -> &QuicConfig {
        &self.config
    }

    pub fn bind(&mut self) {
        let client_config = crate::server::QuicClient::build_client_config(&[]);
        self.endpoint = Some(Endpoint::client(self.config.bind_addr).unwrap());
    }

    pub fn endpoint(&self) -> Option<&Endpoint> {
        self.endpoint.as_ref()
    }

    pub fn connect_blocking(&self, cert_der: &[u8]) -> Option<Connection> {
        if let Some(ref endpoint) = self.endpoint {
            let mut client_config = crate::server::QuicClient::build_client_config(cert_der);
            client_config.enable_datagrams();
            let connecting = endpoint
                .connect_with(
                    client_config,
                    self.config.server_addr,
                    &self.config.server_name,
                )
                .ok()?;
            tokio::runtime::Runtime::new()
                .unwrap()
                .block_on(connecting)
                .ok()
        } else {
            None
        }
    }

    pub fn send_datagram(
        connection: &Connection,
        data: &[u8],
    ) -> Result<(), quinn::SendDatagramError> {
        connection.send_datagram(data.to_vec().into())
    }

    pub fn try_receive_datagram(connection: &Connection) -> Option<Vec<u8>> {
        connection.try_read_datagram().ok().map(|d| d.to_vec())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn client_binds() {
        let mut client = QuicClient::new(QuicConfig::default());
        client.bind();
        assert!(client.endpoint().is_some());
    }
}
