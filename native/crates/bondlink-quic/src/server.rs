use quinn::{ClientConfig, Endpoint, ServerConfig};
use rustls::pki_types::CertificateDer;
use std::sync::Arc;
use std::time::Duration;

use crate::config::QuicConfig;

pub struct QuicServer {
    config: QuicConfig,
}

impl QuicServer {
    pub fn new(config: QuicConfig) -> Self {
        Self { config }
    }

    pub fn config(&self) -> &QuicConfig {
        &self.config
    }

    pub fn generate_cert() -> (Vec<u8>, Vec<u8>) {
        let cert = rcgen::generate_simple_self_signed(vec!["bondlink.local".to_string()]).unwrap();
        let cert_der = cert.serialize_der().unwrap();
        let key_der = cert.serialize_private_key_der();
        (cert_der, key_der)
    }

    pub fn build_server_config(cert_der: Vec<u8>, key_der: Vec<u8>) -> ServerConfig {
        let cert = CertificateDer::from(cert_der);
        let key = rustls::pki_types::PrivatePkcs8KeyDer::from(key_der).into();
        let certs = vec![cert];
        let server_config = rustls::ServerConfig::builder()
            .with_no_client_auth()
            .with_single_cert(certs, key)
            .unwrap();
        let mut server_config = ServerConfig::with_crypto(Arc::new(server_config));
        server_config.transport_config(Arc::new({
            let mut t = quinn::TransportConfig::default();
            t.keep_alive_interval(Some(Duration::from_secs(10)));
            t
        }));
        server_config
    }

    pub fn create_endpoint(&self) -> (Endpoint, Vec<u8>) {
        let (cert_der, key_der) = Self::generate_cert();
        let server_config = Self::build_server_config(cert_der.clone(), key_der);
        let endpoint = Endpoint::server(server_config, self.config.bind_addr).unwrap();
        (endpoint, cert_der)
    }
}

pub struct QuicClient {
    config: QuicConfig,
}

impl QuicClient {
    pub fn new(config: QuicConfig) -> Self {
        Self { config }
    }

    pub fn config(&self) -> &QuicConfig {
        &self.config
    }

    pub fn build_client_config(cert_der: &[u8]) -> ClientConfig {
        let cert = CertificateDer::from(cert_der.to_vec());
        let mut root_store = rustls::RootCertStore::new();
        root_store.add(cert).unwrap();
        let client_config = rustls::ClientConfig::builder()
            .with_root_certificates(Arc::new(root_store))
            .with_no_client_auth();
        ClientConfig::new(Arc::new(client_config))
    }

    pub fn create_endpoint(&self) -> Endpoint {
        let client_config = Self::build_client_config(&[]);
        Endpoint::client(self.config.bind_addr).unwrap()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn server_generates_cert() {
        let (cert, key) = QuicServer::generate_cert();
        assert!(!cert.is_empty());
        assert!(!key.is_empty());
    }

    #[test]
    fn client_builds_config() {
        let (cert_der, _) = QuicServer::generate_cert();
        let _config = QuicClient::build_client_config(&cert_der);
    }

    #[test]
    fn server_config_builds() {
        let (cert, key) = QuicServer::generate_cert();
        let _server_config = QuicServer::build_server_config(cert, key);
    }
}
