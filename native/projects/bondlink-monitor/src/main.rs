use std::collections::HashMap;
use std::process::Command;
use std::time::Duration;

#[derive(Debug, Clone)]
pub struct InterfaceStats {
    pub name: String,
    pub description: String,
    pub mac: String,
    pub ip: String,
    pub gateway: String,
    pub is_up: bool,
    pub speed_mbps: u32,
    pub bytes_sent: u64,
    pub bytes_recv: u64,
    pub packets_sent: u64,
    pub packets_recv: u64,
    pub errors_sent: u64,
    pub errors_recv: u64,
}

pub fn get_network_stats() -> HashMap<String, InterfaceStats> {
    let mut interfaces = HashMap::new();

    // Use netsh to get interface info
    let output = Command::new("netsh")
        .args(&["interface", "show", "interface"])
        .output()
        .expect("Failed to run netsh");

    let output_str = String::from_utf8_lossy(&output.stdout);

    for line in output_str.lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 4 {
            let name = parts[3..].join(" ");
            let is_up = line.contains("Connected");
            
            // Get IP info
            let ip_output = Command::new("cmd")
                .args(&["/c", &format!("netsh interface ipv4 show interface \"{}\"", name)])
                .output()
                .ok();
            
            let mut ip = String::new();
            let mut gateway = String::new();
            
            if let Some(ip_out) = ip_output {
                let ip_str = String::from_utf8_lossy(&ip_out.stdout);
                for ip_line in ip_str.lines() {
                    if ip_line.contains("IP Address") || ip_line.contains("IPv4 Address") {
                        if let Some(pos) = ip_line.find(':') {
                            ip = ip_line[pos+1..].trim().to_string();
                        }
                    }
                    if ip_line.contains("Default Gateway") || ip_line.contains("default gateway") {
                        if let Some(pos) = ip_line.find(':') {
                            gateway = ip_line[pos+1..].trim().to_string();
                        }
                    }
                }
            }

            // Get MAC from getmac
            let mac_output = Command::new("getmac")
                .args(&["/v", "/fo", "csv"])
                .output()
                .ok();
            
            let mut mac = String::new();
            if let Some(mac_out) = mac_output {
                let mac_str = String::from_utf8_lossy(&mac_out.stdout);
                for mac_line in mac_str.lines() {
                    if mac_line.to_lowercase().contains(&name.to_lowercase()) {
                        let csv_parts: Vec<&str> = mac_line.split(',').collect();
                        if csv_parts.len() > 1 {
                            mac = csv_parts[1].trim().trim_matches('"').to_string();
                        }
                    }
                }
            }

            // Get speed from wmic
            let speed_output = Command::new("wmic")
                .args(&["nic", "where", &format!("NetConnectionID='{}'", name), "get", "Speed", "/value"])
                .output()
                .ok();
            
            let mut speed = 0u64;
            if let Some(speed_out) = speed_output {
                let speed_str = String::from_utf8_lossy(&speed_out.stdout);
                for speed_line in speed_str.lines() {
                    if speed_line.starts_with("Speed=") {
                        speed = speed_line[6..].trim().parse().unwrap_or(0);
                    }
                }
            }

            // Get statistics from netstat
            let stats_output = Command::new("netstat")
                .args(&["-e"])
                .output()
                .ok();
            
            let mut bytes_sent = 0u64;
            let mut bytes_recv = 0u64;
            let mut packets_sent = 0u64;
            let mut packets_recv = 0u64;

            if let Some(stats_out) = stats_output {
                let stats_str = String::from_utf8_lossy(&stats_out.stdout);
                for stats_line in stats_str.lines() {
                    if !stats_line.trim().is_empty() && !stats_line.contains("Statistics") {
                        let stats_parts: Vec<&str> = stats_line.split_whitespace().collect();
                        if stats_parts.len() >= 3 {
                            if let Ok(recv) = stats_parts[1].parse::<u64>() {
                                if let Ok(sent) = stats_parts[2].parse::<u64>() {
                                    bytes_recv = recv;
                                    bytes_sent = sent;
                                    packets_recv = recv / 1000;  // Approximate
                                    packets_sent = sent / 1000;
                                }
                            }
                        }
                    }
                }
            }

            interfaces.insert(name.clone(), InterfaceStats {
                name,
                description: String::new(),
                mac,
                ip,
                gateway,
                is_up,
                speed_mbps: (speed / 1_000_000) as u32,
                bytes_sent,
                bytes_recv,
                packets_sent,
                packets_recv,
                errors_sent: 0,
                errors_recv: 0,
            });
        }
    }

    interfaces
}

fn print_status(interfaces: &HashMap<String, InterfaceStats>) {
    println!("╔════════════════════════════════════════════════════════════════════════════════════╗");
    println!("║                         BondLink Network Monitor v0.1.0                            ║");
    println!("╠════════════════════════════════════════════════════════════════════════════════════╣");
    println!("║ {:15} │ {:8} │ {:12} │ {:15} │ {:15} │ {:8} ║", 
        "Interface", "Status", "Speed", "IP", "Gateway", "IP");
    println!("╠════════════════════════════════════════════════════════════════════════════════════╣");

    let mut total_sent = 0u64;
    let mut total_recv = 0u64;
    let mut total_pkt_sent = 0u64;
    let mut total_pkt_recv = 0u64;
    let mut total_speed = 0u32;
    let mut active_count = 0;

    for (_, stats) in interfaces.iter() {
        let status = if stats.is_up { "🟢 UP  " } else { "🔴 DOWN" };
        
        let speed_str = if stats.speed_mbps >= 1000 {
            format!("{} Gbps", stats.speed_mbps / 1000)
        } else {
            format!("{} Mbps", stats.speed_mbps)
        };

        let ip_short = if stats.ip.len() > 15 {
            &stats.ip[..15]
        } else {
            &stats.ip
        };
        
        let gw_short = if stats.gateway.len() > 15 {
            &stats.gateway[..15]
        } else {
            &stats.gateway
        };

        println!("║ {:15} │ {} │ {:12} │ {:15} │ {:15} │ {:8} ║",
            if stats.name.len() > 15 { &stats.name[..15] } else { &stats.name },
            status,
            speed_str,
            ip_short,
            gw_short,
            if stats.is_up { "Active" } else { "Idle" }
        );

        if stats.is_up {
            total_sent += stats.bytes_sent;
            total_recv += stats.bytes_recv;
            total_pkt_sent += stats.packets_sent;
            total_pkt_recv += stats.packets_recv;
            total_speed += stats.speed_mbps;
            active_count += 1;
        }
    }

    println!("╠════════════════════════════════════════════════════════════════════════════════════╣");
    println!("║ TOTAL: {} active interfaces | {} Mbps combined speed                              ║", 
        active_count, total_speed);
    println!("║ TX: {} bytes ({} pkts) │ RX: {} bytes ({} pkts)                                    ║",
        total_sent, total_pkt_sent, total_recv, total_pkt_recv);
    println!("╚════════════════════════════════════════════════════════════════════════════════════╝");
}

fn main() {
    loop {
        print!("\x1B[2J\x1B[1;1H");  // Clear screen
        let interfaces = get_network_stats();
        print_status(&interfaces);
        std::thread::sleep(Duration::from_secs(2));
    }
}
