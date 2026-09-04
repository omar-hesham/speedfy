use std::fs::OpenOptions;
use std::io::Write;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum LogLevel {
    Debug,
    Info,
    Warn,
    Error,
}

#[derive(Debug, Clone)]
pub struct LogEntry {
    pub timestamp: u64,
    pub level: LogLevel,
    pub component: String,
    pub event: String,
    pub message: String,
    pub details: Option<String>,
}

pub struct Logger {
    file: std::fs::File,
}

impl Logger {
    pub fn new(path: &str) -> std::io::Result<Self> {
        let file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(path)?;
        
        Ok(Self { file })
    }

    pub fn log(&mut self, level: LogLevel, component: &str, event: &str, message: &str, details: Option<&str>) {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;

        let level_str = match level {
            LogLevel::Debug => "DEBUG",
            LogLevel::Info => "INFO",
            LogLevel::Warn => "WARN",
            LogLevel::Error => "ERROR",
        };

        let line = format!(
            "[{}] [{}] [{}] {}{}\n",
            timestamp,
            level_str,
            component,
            message,
            details.map(|d| format!(" | {}", d)).unwrap_or_default()
        );

        let _ = self.file.write_all(line.as_bytes());
        let _ = self.file.flush();

        // Also print to console
        println!("{}", line.trim());
    }

    pub fn info(&mut self, component: &str, event: &str, message: &str) {
        self.log(LogLevel::Info, component, event, message, None);
    }

    pub fn warn(&mut self, component: &str, event: &str, message: &str) {
        self.log(LogLevel::Warn, component, event, message, None);
    }

    pub fn error(&mut self, component: &str, event: &str, message: &str) {
        self.log(LogLevel::Error, component, event, message, None);
    }

    pub fn debug(&mut self, component: &str, event: &str, message: &str) {
        self.log(LogLevel::Debug, component, event, message, None);
    }
}

// Global logger instance
use std::sync::{Arc, Mutex};

lazy_static::lazy_static! {
    pub static ref GLOBAL_LOGGER: Arc<Mutex<Logger>> = Arc::new(Mutex::new(
        Logger::new("logs/bondlink.log").expect("Failed to create logger")
    ));
}

#[macro_export]
macro_rules! log_info {
    ($component:expr, $event:expr, $($arg:tt)*) => {
        $crate::GLOBAL_LOGGER.lock().unwrap().info(
            $component,
            $event,
            &format!($($arg)*)
        );
    };
}

#[macro_export]
macro_rules! log_warn {
    ($component:expr, $event:expr, $($arg:tt)*) => {
        $crate::GLOBAL_LOGGER.lock().unwrap().warn(
            $component,
            $event,
            &format!($($arg)*)
        );
    };
}

#[macro_export]
macro_rules! log_error {
    ($component:expr, $event:expr, $($arg:tt)*) => {
        $crate::GLOBAL_LOGGER.lock().unwrap().error(
            $component,
            $event,
            &format!($($arg)*)
        );
    };
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn log_entry_format() {
        let entry = LogEntry {
            timestamp: 1234567890,
            level: LogLevel::Info,
            component: "test".to_string(),
            event: "test_event".to_string(),
            message: "Test message".to_string(),
            details: Some("details".to_string()),
        };
        
        assert_eq!(entry.level, LogLevel::Info);
        assert_eq!(entry.component, "test");
    }
}
