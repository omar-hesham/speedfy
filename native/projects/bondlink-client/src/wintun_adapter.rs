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
        // First, try to open existing adapter
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
        // First, try to shutdown any existing session
        if let Some(ref session) = self.session {
            info!("Shutting down existing session...");
            let _ = session.shutdown();
            self.session = None;
        }

        let adapter = self.adapter.as_ref().ok_or_else(|| anyhow::anyhow!("No adapter"))?;

        // If adapter exists but session failed, try to recreate
        match adapter.start_session(wintun_bindings::MAX_RING_CAPACITY) {
            Ok(session) => {
                self.session = Some(session);
                info!("Session started");
                Ok(())
            }
            Err(e) => {
                warn!("Failed to start session on existing adapter: {}. Recreating adapter...", e);
                // Close and recreate
                self.adapter = None;
                let adapter = wintun_bindings::Adapter::create(
                    &self.wintun,
                    &self.adapter_name,
                    &self.tunnel_name,
                    None,
                )?;
                self.adapter = Some(adapter);
                
                let session = self.adapter.as_ref().unwrap().start_session(wintun_bindings::MAX_RING_CAPACITY)?;
                self.session = Some(session);
                info!("Session started on new adapter");
                Ok(())
            }
        }
    }

    pub fn configure_interface(&self, ip: &str, netmask: &str, gateway: &str) -> Result<()> {
        info!("Configuring interface: {}/{}", ip, netmask);
        
        // Set IP address
        std::process::Command::new("netsh")
            .args(&["interface", "ipv4", "set", "address",
                &format!("name=\"{}\"", self.adapter_name), "static", ip, netmask])
            .output()?;

        if !gateway.is_empty() {
            // Remove existing default routes for this interface first
            let _ = std::process::Command::new("netsh")
                .args(&["interface", "ipv4", "delete", "route",
                    "0.0.0.0/0", &self.adapter_name])
                .output();
            
            // Add default route with metric 1 (highest priority)
            std::process::Command::new("netsh")
                .args(&["interface", "ipv4", "add", "route",
                    "0.0.0.0/0", &self.adapter_name, gateway, "metric=1"])
                .output()?;
        }

        // Set MTU
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
            info!("Shutting down session...");
            let _ = session.shutdown();
        }
        Ok(())
    }
}

impl Drop for WintunAdapter {
    fn drop(&mut self) {
        let _ = self.shutdown();
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
