use std::collections::HashMap;
use std::process::Command;
use std::time::Duration;

#[derive(Debug, Clone)]
pub struct InterfaceStats {
    pub name: String,
    pub description: String,
    pub ip: String,
    pub gateway: String,
    pub mac: String,
    pub is_up: bool,
    pub speed_mbps: u32,
}

/// Parse PowerShell key-value output (Name : Value format)
fn parse_ps_blocks(output: &str) -> Vec<HashMap<String, String>> {
    let mut blocks = Vec::new();
    let mut current_block = HashMap::new();

    for line in output.lines() {
        let line = line.trim();
        if line.is_empty() {
            if !current_block.is_empty() {
                blocks.push(current_block);
                current_block = HashMap::new();
            }
            continue;
        }

        if let Some(pos) = line.find(':') {
            let key = line[..pos].trim().to_string();
            let value = line[pos + 1..].trim().to_string();
            if !key.is_empty() {
                current_block.insert(key, value);
            }
        }
    }

    if !current_block.is_empty() {
        blocks.push(current_block);
    }

    blocks
}

/// Check if adapter is a real physical interface (not virtual)
fn is_physical_interface(description: &str, name: &str) -> bool {
    if description.to_lowercase().contains("hyper-v")
        || description.to_lowercase().contains("vmware")
        || description.to_lowercase().contains("virtualbox")
        || description.to_lowercase().contains("wi-fi direct")
        || description.to_lowercase().contains("microsoft wi-fi")
        || description.to_lowercase().contains("bluetooth")
        || name.to_lowercase().contains("vethernet")
        || name.to_lowercase().contains("local area connection*")
    {
        return false;
    }
    true
}

/// Get network interface statistics using PowerShell
pub fn get_network_stats() -> HashMap<String, InterfaceStats> {
    let mut interfaces = HashMap::new();

    // Use PowerShell directly with -Command
    let output = Command::new("powershell")
        .args(&[
            "-NoProfile",
            "-Command",
            "Get-NetAdapter | Format-List Name, InterfaceDescription, MacAddress, Status, LinkSpeed",
        ])
        .output()
        .ok();

    if let Some(out) = output {
        let output_str = String::from_utf8_lossy(&out.stdout);
        let blocks = parse_ps_blocks(&output_str);

        for props in blocks {
            if let (Some(name), Some(description), Some(mac), Some(status), Some(link_speed)) = (
                props.get("Name"),
                props.get("InterfaceDescription"),
                props.get("MacAddress"),
                props.get("Status"),
                props.get("LinkSpeed"),
            ) {
                // Skip virtual interfaces
                if !is_physical_interface(description, name) {
                    continue;
                }

                let is_up = status == "Up";
                let speed_mbps = parse_speed(link_speed);

                // Get IP and gateway
                let (ip, gateway) = get_ip_and_gateway(name);

                interfaces.insert(
                    name.clone(),
                    InterfaceStats {
                        name: name.clone(),
                        description: description.clone(),
                        ip,
                        gateway,
                        mac: mac.clone(),
                        is_up,
                        speed_mbps,
                    },
                );
            }
        }
    }

    interfaces
}

fn parse_speed(speed_str: &str) -> u32 {
    let speed_str = speed_str.trim();
    if speed_str.contains("Gbps") || speed_str.contains("Gbit") {
        speed_str
            .split_whitespace()
            .next()
            .and_then(|s| s.parse::<f64>().ok())
            .map(|v| (v * 1000.0) as u32)
            .unwrap_or(0)
    } else if speed_str.contains("Mbps") || speed_str.contains("Mbit") {
        speed_str
            .split_whitespace()
            .next()
            .and_then(|s| s.parse::<u32>().ok())
            .unwrap_or(0)
    } else {
        0
    }
}

fn get_ip_and_gateway(adapter_name: &str) -> (String, String) {
    let mut ip = String::new();
    let mut gateway = String::new();

    // Get IP address
    let ip_output = Command::new("powershell")
        .args(&[
            "-NoProfile",
            "-Command",
            &format!(
                "Get-NetIPAddress -InterfaceAlias '{}' -AddressFamily IPv4 -ErrorAction SilentlyContinue | Format-List IPAddress",
                adapter_name
            ),
        ])
        .output()
        .ok();

    if let Some(out) = ip_output {
        let blocks = parse_ps_blocks(&String::from_utf8_lossy(&out.stdout));
        if let Some(first) = blocks.first() {
            if let Some(addr) = first.get("IPAddress") {
                ip = addr.clone();
            }
        }
    }

    // Get default gateway
    let gw_output = Command::new("powershell")
        .args(&[
            "-NoProfile",
            "-Command",
            &format!(
                "Get-NetRoute -InterfaceAlias '{}' -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue | Format-List NextHop",
                adapter_name
            ),
        ])
        .output()
        .ok();

    if let Some(out) = gw_output {
        let blocks = parse_ps_blocks(&String::from_utf8_lossy(&out.stdout));
        if let Some(first) = blocks.first() {
            if let Some(gw) = first.get("NextHop") {
                gateway = gw.clone();
            }
        }
    }

    (ip, gateway)
}

fn print_status(interfaces: &HashMap<String, InterfaceStats>) {
    println!("BondLink Network Monitor v0.1.0");
    println!("================================\n");

    let mut total_speed = 0u32;
    let mut active_count = 0;

    // Sort interfaces by name
    let mut sorted: Vec<_> = interfaces.iter().collect();
    sorted.sort_by_key(|(name, _)| name.as_str());

    for (_, stats) in sorted {
        let status = if stats.is_up { "UP  " } else { "DOWN" };
        println!("[{}] {} ({} Mbps)", status, stats.name, stats.speed_mbps);
        println!(
            "    IP: {} | GW: {} | MAC: {}",
            if stats.ip.is_empty() {
                "N/A"
            } else {
                &stats.ip
            },
            if stats.gateway.is_empty() {
                "N/A"
            } else {
                &stats.gateway
            },
            if stats.mac.is_empty() {
                "N/A"
            } else {
                &stats.mac
            }
        );

        if stats.is_up {
            total_speed += stats.speed_mbps;
            active_count += 1;
        }
        println!();
    }

    println!(
        "Total: {} active interfaces | {} Mbps combined speed",
        active_count, total_speed
    );
}

fn main() {
    loop {
        print!("\x1B[2J\x1B[1;1H"); // Clear screen
        let interfaces = get_network_stats();
        print_status(&interfaces);
        std::thread::sleep(Duration::from_secs(2));
    }
}
