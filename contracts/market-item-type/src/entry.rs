use ckb_std::{
    ckb_constants::Source,
    ckb_types::prelude::*,
    debug,
    high_level::{load_cell_data, QueryIter},
};

use crate::error::Error;
use crate::generated::MarketItem;

enum Operation {
    Create,
    Transfer,
    Burn,
}

/// Detect whether this is a Create, Transfer, or Burn by checking
/// if cells with our type script exist in GroupInput and GroupOutput.
fn detect_operation() -> Result<Operation, Error> {
    let has_input = QueryIter::new(load_cell_data, Source::GroupInput)
        .next()
        .is_some();
    let has_output = QueryIter::new(load_cell_data, Source::GroupOutput)
        .next()
        .is_some();

    match (has_input, has_output) {
        (false, true) => Ok(Operation::Create),
        (true, true) => Ok(Operation::Transfer),
        (true, false) => Ok(Operation::Burn),
        (false, false) => Err(Error::Encoding),
    }
}

pub fn main() -> Result<(), Error> {
    let operation = detect_operation()?;

    match operation {
        Operation::Create => handle_create(),
        Operation::Transfer => handle_transfer(),
        Operation::Burn => {
            debug!("market-item-type: burn allowed");
            Ok(())
        }
    }
}

/// On CREATE: validate that cell data is a well-formed MarketItem
/// with non-empty content_type, description, and content.
fn handle_create() -> Result<(), Error> {
    let mut index = 0usize;
    loop {
        let data = match load_cell_data(index, Source::GroupOutput) {
            Ok(data) => data,
            Err(_) => break,
        };

        let market_item = MarketItem::from_compatible_slice(&data)
            .map_err(|_| Error::InvalidMarketItemData)?;

        if market_item.content_type().is_empty() {
            return Err(Error::EmptyContentType);
        }

        // Validate MIME format: must contain '/' and use restricted chars
        let ct_bytes = market_item.content_type().raw_data();
        validate_mime(&ct_bytes)?;

        if market_item.description().is_empty() {
            return Err(Error::EmptyDescription);
        }

        if market_item.content().is_empty() {
            return Err(Error::EmptyContent);
        }

        debug!("market-item-type: create validated for output {}", index);
        index += 1;
    }

    Ok(())
}

/// Basic MIME validation: must contain '/' and use restricted ASCII chars.
fn validate_mime(raw: &[u8]) -> Result<(), Error> {
    let has_slash = raw.iter().any(|&b| b == b'/');
    if !has_slash {
        return Err(Error::InvalidMimeFormat);
    }
    for &byte in raw {
        if !(byte.is_ascii_alphanumeric()
            || byte == b'-'
            || byte == b'+'
            || byte == b'.'
            || byte == b'/'
            || byte == b';'
            || byte == b'='
            || byte == b' ')
        {
            return Err(Error::InvalidMimeFormat);
        }
    }
    Ok(())
}

/// On TRANSFER: content_type and content must not change.
/// Description may change freely.
fn handle_transfer() -> Result<(), Error> {
    let mut index = 0usize;
    loop {
        let input_data = match load_cell_data(index, Source::GroupInput) {
            Ok(data) => data,
            Err(_) => break,
        };
        let output_data = match load_cell_data(index, Source::GroupOutput) {
            Ok(data) => data,
            Err(_) => break,
        };

        let input_item = MarketItem::from_compatible_slice(&input_data)
            .map_err(|_| Error::InvalidMarketItemData)?;
        let output_item = MarketItem::from_compatible_slice(&output_data)
            .map_err(|_| Error::InvalidMarketItemData)?;

        if input_item.content_type().as_slice() != output_item.content_type().as_slice() {
            return Err(Error::ContentTypeChanged);
        }

        if input_item.content().as_slice() != output_item.content().as_slice() {
            return Err(Error::ContentChanged);
        }

        debug!("market-item-type: transfer validated for pair {}", index);
        index += 1;
    }

    Ok(())
}
