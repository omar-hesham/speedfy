use anyhow::Result;
use std::sync::Arc;
use tracing::{info, warn};

pub struct WintunAdapter {
    adapter_name: String,
    tunnel_name: String,
    wintun: wintun_bindings::Wintun,
    adapter: Option<Arc<wintun_bindings::Adapter>>,
    session: Option<Arc<wintun_bindings::Session>>,
    mtu: u16,
}

impl WintunAdapter {
    pub fn new(adapter_name: String, tunnel_name: String, mtu: u16) -> Self {
        Self {
            adapter_name,
            tunnel_name,
            wintun: unsafe { wintun_bindings::load() }.expect("Failed to load wintun.dll"),
            adapter: None,
            session: None,
            mtu,
        }
    }

    pub fn mtu(&self) -> u16 {
        self.mtu
    }

    pub fn create_adapter(&mut self) -> Result<()> {
        match wintun_bindings::Adapter::open(&self.wintun, &self.adapter_name) {
            Ok(adapter) => {
                info!("Opened existing adapter: {}", self.adapter_name);
                self.adapter = Some(adapter);
                Ok(())
            }
            Err(_) => {
                info!("Creating new adapter: {}", self.adapter_name);
                let adapter = wintun_bindings::Adapter::create(
                    &self.wintun,
                    &self.adapter_name,
                    &self.tunnel_name,
                    None,
                )?;
                self.adapter = Some(adapter);
                info!("Adapter created: {}", self.adapter_name);
                Ok(())
            }
        }
    }

    pub fn start_session(&mut self) -> Result<()> {
        let adapter = self.adapter.as_ref().ok_or_else(|| anyhow::anyhow!("No adapter"))?;
        let session = adapter.start_session(wintun_bindings::MAX_RING_CAPACITY)?;
        self.session = Some(session);
        info!("Session started");
        Ok(())
    }

    pub fn configure_interface(&self, ip: &str, netmask: &str, gateway: &str) -> Result<()> {
        info!("Configuring interface: {}/{}", ip, netmask);
        
        std::process::Command::new("netsh")
            .args(&["interface", "ipv4", "set", "address",
                &format!("name=\"{}\"", self.adapter_name), "static", ip, netmask])
            .output()?;

        if !gateway.is_empty() {
            std::process::Command::new("netsh")
                .args(&["interface", "ipv4", "add", "route",
                    "0.0.0.0/0", &self.adapter_name, gateway, "metric=1"])
                .output()?;
        }

        std::process::Command::new("netsh")
            .args(&["interface", "ipv4", "set", "subinterface",
                &self.adapter_name, &format!("mtu={}", self.mtu)])
            .output()?;

        info!("Interface configured");
        Ok(())
    }

    pub fn read_packet(&self, buf: &mut [u8]) -> Result<usize> {
        let session = self.session.as_ref().ok_or_else(|| anyhow::anyhow!("No session"))?;
        
        match session.try_receive()? {
            Some(packet) => {
                let len = packet.bytes().len().min(buf.len());
                buf[..len].copy_from_slice(&packet.bytes()[..len]);
                Ok(len)
            }
            None => Ok(0),
        }
    }

    pub fn write_packet(&self, data: &[u8]) -> Result<()> {
        let session = self.session.as_ref().ok_or_else(|| anyhow::anyhow!("No session"))?;
        let mut packet = session.allocate_send_packet(data.len() as u16)?;
        packet.bytes_mut().copy_from_slice(data);
        session.send_packet(packet);
        Ok(())
    }

    pub fn shutdown(&self) -> Result<()> {
        if let Some(ref session) = self.session {
            session.shutdown()?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn adapter_config() {
        let adapter = WintunAdapter::new("Test".to_string(), "Test Tunnel".to_string(), 1280);
        assert_eq!(adapter.mtu(), 1280);
    }
}
