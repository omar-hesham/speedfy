use bytes::{BufMut, Bytes, BytesMut};
use thiserror::Error;

pub const WIRE_VERSION: u8 = 1;
pub const WIRE_HEADER_LEN: usize = 20;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum WireKind {
    Data = 0x01,
    Probe = 0x02,
    Ack = 0x03,
    Control = 0x04,
}

#[derive(Debug, Error)]
pub enum WireError {
    #[error("unsupported wire version {0}")]
    UnsupportedVersion(u8),
    #[error("truncated header: got {0}, need {1}")]
    TruncatedHeader(usize, usize),
    #[error("unknown wire kind {0}")]
    UnknownKind(u8),
}

#[derive(Debug, Clone)]
pub struct WireEnvelope {
    version: u8,
    kind: WireKind,
    flags: u16,
    sequence: u64,
    sent_monotonic_micros: u64,
    payload: Bytes,
}

impl WireEnvelope {
    pub fn new_data(sequence: u64, flags: u16, sent_monotonic_micros: u64, payload: &[u8]) -> Self {
        Self {
            version: WIRE_VERSION,
            kind: WireKind::Data,
            flags,
            sequence,
            sent_monotonic_micros,
            payload: Bytes::copy_from_slice(payload),
        }
    }

    pub fn new_probe(sequence: u64, sent_monotonic_micros: u64) -> Self {
        Self {
            version: WIRE_VERSION,
            kind: WireKind::Probe,
            flags: 0,
            sequence,
            sent_monotonic_micros,
            payload: Bytes::new(),
        }
    }

    pub fn encode(&self) -> BytesMut {
        let payload_len = self.payload.len();
        let total = WIRE_HEADER_LEN + payload_len;
        let mut buf = BytesMut::with_capacity(total);
        buf.put_u8(self.version);
        buf.put_u8(self.kind as u8);
        buf.put_u16(self.flags);
        buf.put_u64(self.sequence);
        buf.put_u64(self.sent_monotonic_micros);
        buf.extend_from_slice(&self.payload);
        buf
    }

    pub fn decode(buf: &[u8]) -> Result<Self, WireError> {
        if buf.len() < WIRE_HEADER_LEN {
            return Err(WireError::TruncatedHeader(buf.len(), WIRE_HEADER_LEN));
        }
        let version = buf[0];
        if version != WIRE_VERSION {
            return Err(WireError::UnsupportedVersion(version));
        }
        let kind = match buf[1] {
            0x01 => WireKind::Data,
            0x02 => WireKind::Probe,
            0x03 => WireKind::Ack,
            0x04 => WireKind::Control,
            other => return Err(WireError::UnknownKind(other)),
        };
        let flags = u16::from_be_bytes([buf[2], buf[3]]);
        let sequence = u64::from_be_bytes(buf[4..12].try_into().unwrap());
        let sent_monotonic_micros = u64::from_be_bytes(buf[12..20].try_into().unwrap());
        let payload = Bytes::copy_from_slice(&buf[20..]);
        Ok(Self {
            version,
            kind,
            flags,
            sequence,
            sent_monotonic_micros,
            payload,
        })
    }

    pub fn version(&self) -> u8 {
        self.version
    }
    pub fn kind(&self) -> WireKind {
        self.kind
    }
    pub fn flags(&self) -> u16 {
        self.flags
    }
    pub fn sequence(&self) -> u64 {
        self.sequence
    }
    pub fn sent_monotonic_micros(&self) -> u64 {
        self.sent_monotonic_micros
    }
    pub fn payload(&self) -> &[u8] {
        &self.payload
    }
    pub fn payload_len(&self) -> usize {
        self.payload.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trip_data_envelope() {
        let original = WireEnvelope::new_data(1, 0x0001, 1_000_000, b"hello world");
        let bytes = original.encode();
        let decoded = WireEnvelope::decode(&bytes).unwrap();
        assert_eq!(decoded.version(), 1);
        assert_eq!(decoded.kind(), WireKind::Data);
        assert_eq!(decoded.sequence(), 1);
        assert_eq!(decoded.flags(), 0x0001);
        assert_eq!(decoded.sent_monotonic_micros(), 1_000_000);
        assert_eq!(decoded.payload(), b"hello world");
    }

    #[test]
    fn reject_unknown_version() {
        let mut bytes = WireEnvelope::new_data(1, 0, 0, b"x").encode();
        bytes[0] = 99;
        assert!(WireEnvelope::decode(&bytes).is_err());
    }

    #[test]
    fn reject_truncated_header() {
        let bytes = &[
            0x11u8, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x05,
        ][..];
        assert!(WireEnvelope::decode(bytes).is_err());
    }

    #[test]
    fn probe_round_trip() {
        let probe = WireEnvelope::new_probe(42, 2_000_000);
        let bytes = probe.encode();
        let decoded = WireEnvelope::decode(&bytes).unwrap();
        assert_eq!(decoded.kind(), WireKind::Probe);
        assert_eq!(decoded.sequence(), 42);
        assert_eq!(decoded.payload_len(), 0);
    }
}
