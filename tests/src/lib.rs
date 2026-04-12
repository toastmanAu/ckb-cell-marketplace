use ckb_testtool::ckb_types::bytes::Bytes;
use std::fs;
use std::path::PathBuf;

mod tests;

pub const MAX_CYCLES: u64 = 10_000_000;

pub fn load_contract_binary() -> Bytes {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../build/market-item-type");
    fs::read(&path)
        .unwrap_or_else(|e| {
            panic!(
                "failed to read {}: {}. Build contract first: make build",
                path.display(),
                e
            )
        })
        .into()
}

/// Build a MarketItem molecule table from raw field bytes.
///
/// Encodes the molecule table header (total_size + 3 offsets) followed by
/// three Bytes fields (each with a 4-byte LE length prefix).
pub fn build_market_item(content_type: &[u8], description: &[u8], content: &[u8]) -> Bytes {
    let ct_len = content_type.len() as u32;
    let desc_len = description.len() as u32;
    let cont_len = content.len() as u32;

    // Each molecule Bytes field is: 4-byte LE item_count + raw bytes
    let ct_field_size = 4 + ct_len;
    let desc_field_size = 4 + desc_len;
    let cont_field_size = 4 + cont_len;

    // Table header: 4 (total_size) + 3 * 4 (field offsets) = 16 bytes
    let header_size: u32 = 16;
    let total_size = header_size + ct_field_size + desc_field_size + cont_field_size;

    let offset_ct = header_size;
    let offset_desc = offset_ct + ct_field_size;
    let offset_cont = offset_desc + desc_field_size;

    let mut data = Vec::with_capacity(total_size as usize);
    data.extend_from_slice(&total_size.to_le_bytes());
    data.extend_from_slice(&offset_ct.to_le_bytes());
    data.extend_from_slice(&offset_desc.to_le_bytes());
    data.extend_from_slice(&offset_cont.to_le_bytes());

    data.extend_from_slice(&ct_len.to_le_bytes());
    data.extend_from_slice(content_type);

    data.extend_from_slice(&desc_len.to_le_bytes());
    data.extend_from_slice(description);

    data.extend_from_slice(&cont_len.to_le_bytes());
    data.extend_from_slice(content);

    Bytes::from(data)
}
