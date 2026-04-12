use ckb_testtool::builtin::ALWAYS_SUCCESS;
use ckb_testtool::ckb_types::{
    bytes::Bytes,
    core::TransactionBuilder,
    packed::{CellInput, CellOutput},
    prelude::*,
};
use ckb_testtool::context::Context;

use crate::{build_market_item, load_contract_binary, MAX_CYCLES};

/// Deploy the market-item-type contract and the always-success lock.
/// Returns (context, type_script, lock_script).
fn setup() -> (Context, ckb_testtool::ckb_types::packed::Script, ckb_testtool::ckb_types::packed::Script) {
    let mut context = Context::default();

    // Deploy always-success as the lock script (inputs need a lock that passes).
    let always_success_out_point = context.deploy_cell(ALWAYS_SUCCESS.clone());
    let lock_script = context
        .build_script(&always_success_out_point, Bytes::default())
        .expect("always-success lock script");

    // Deploy the market-item-type contract.
    let contract_out_point = context.deploy_cell(load_contract_binary());
    let type_script = context
        .build_script(&contract_out_point, Bytes::default())
        .expect("market-item-type script");

    (context, type_script, lock_script)
}

/// Capacity large enough to hold a cell with data. CKB requires at least
/// 61 bytes of capacity for a basic cell; we use a generous value.
const CELL_CAPACITY: u64 = 200_000_000_000; // 2000 CKB in shannons

// ─── CREATE TESTS ────────────────────────────────────────────────────

#[test]
fn test_create_valid_market_item() {
    let (mut context, type_script, lock_script) = setup();

    let data = build_market_item(b"image/png", b"A pixel art piece", &[0xDE, 0xAD, 0xBE, 0xEF]);

    let output = CellOutput::new_builder()
        .capacity(CELL_CAPACITY)
        .lock(lock_script.clone())
        .type_(Some(type_script).pack())
        .build();

    // Build a tx that creates the MarketItem cell.
    // We need a dummy input to fund the output.
    let dummy_input_out_point = context.create_cell(
        CellOutput::new_builder()
            .capacity(CELL_CAPACITY)
            .lock(lock_script)
            .build(),
        Bytes::new(),
    );
    let input = CellInput::new_builder()
        .previous_output(dummy_input_out_point)
        .build();

    let tx = TransactionBuilder::default()
        .input(input)
        .output(output)
        .output_data(data.pack())
        .build();

    let tx = context.complete_tx(tx);
    let cycles = context
        .verify_tx(&tx, MAX_CYCLES)
        .expect("create valid market item should pass");
    println!("test_create_valid_market_item: {} cycles", cycles);
}

#[test]
fn test_create_empty_content_type_fails() {
    let (mut context, type_script, lock_script) = setup();

    let data = build_market_item(b"", b"A description", &[0x01, 0x02]);

    let output = CellOutput::new_builder()
        .capacity(CELL_CAPACITY)
        .lock(lock_script.clone())
        .type_(Some(type_script).pack())
        .build();

    let dummy_input_out_point = context.create_cell(
        CellOutput::new_builder()
            .capacity(CELL_CAPACITY)
            .lock(lock_script)
            .build(),
        Bytes::new(),
    );
    let input = CellInput::new_builder()
        .previous_output(dummy_input_out_point)
        .build();

    let tx = TransactionBuilder::default()
        .input(input)
        .output(output)
        .output_data(data.pack())
        .build();

    let tx = context.complete_tx(tx);
    let result = context.verify_tx(&tx, MAX_CYCLES);
    assert!(result.is_err(), "empty content_type should fail");
    let msg = format!("{:?}", result.unwrap_err());
    println!("test_create_empty_content_type_fails: {}", msg);
    assert!(
        msg.contains("21") || msg.contains("EmptyContentType"),
        "expected error code 21, got: {}",
        msg
    );
}

#[test]
fn test_create_empty_description_fails() {
    let (mut context, type_script, lock_script) = setup();

    let data = build_market_item(b"image/png", b"", &[0x01, 0x02]);

    let output = CellOutput::new_builder()
        .capacity(CELL_CAPACITY)
        .lock(lock_script.clone())
        .type_(Some(type_script).pack())
        .build();

    let dummy_input_out_point = context.create_cell(
        CellOutput::new_builder()
            .capacity(CELL_CAPACITY)
            .lock(lock_script)
            .build(),
        Bytes::new(),
    );
    let input = CellInput::new_builder()
        .previous_output(dummy_input_out_point)
        .build();

    let tx = TransactionBuilder::default()
        .input(input)
        .output(output)
        .output_data(data.pack())
        .build();

    let tx = context.complete_tx(tx);
    let result = context.verify_tx(&tx, MAX_CYCLES);
    assert!(result.is_err(), "empty description should fail");
    let msg = format!("{:?}", result.unwrap_err());
    println!("test_create_empty_description_fails: {}", msg);
    assert!(
        msg.contains("22") || msg.contains("EmptyDescription"),
        "expected error code 22, got: {}",
        msg
    );
}

#[test]
fn test_create_empty_content_fails() {
    let (mut context, type_script, lock_script) = setup();

    let data = build_market_item(b"image/png", b"Some description", b"");

    let output = CellOutput::new_builder()
        .capacity(CELL_CAPACITY)
        .lock(lock_script.clone())
        .type_(Some(type_script).pack())
        .build();

    let dummy_input_out_point = context.create_cell(
        CellOutput::new_builder()
            .capacity(CELL_CAPACITY)
            .lock(lock_script)
            .build(),
        Bytes::new(),
    );
    let input = CellInput::new_builder()
        .previous_output(dummy_input_out_point)
        .build();

    let tx = TransactionBuilder::default()
        .input(input)
        .output(output)
        .output_data(data.pack())
        .build();

    let tx = context.complete_tx(tx);
    let result = context.verify_tx(&tx, MAX_CYCLES);
    assert!(result.is_err(), "empty content should fail");
    let msg = format!("{:?}", result.unwrap_err());
    println!("test_create_empty_content_fails: {}", msg);
    assert!(
        msg.contains("23") || msg.contains("EmptyContent"),
        "expected error code 23, got: {}",
        msg
    );
}

#[test]
fn test_create_invalid_mime_fails() {
    let (mut context, type_script, lock_script) = setup();

    // "not_a_mime" has no slash — should fail MIME validation.
    let data = build_market_item(b"not_a_mime", b"A description", &[0x01, 0x02]);

    let output = CellOutput::new_builder()
        .capacity(CELL_CAPACITY)
        .lock(lock_script.clone())
        .type_(Some(type_script).pack())
        .build();

    let dummy_input_out_point = context.create_cell(
        CellOutput::new_builder()
            .capacity(CELL_CAPACITY)
            .lock(lock_script)
            .build(),
        Bytes::new(),
    );
    let input = CellInput::new_builder()
        .previous_output(dummy_input_out_point)
        .build();

    let tx = TransactionBuilder::default()
        .input(input)
        .output(output)
        .output_data(data.pack())
        .build();

    let tx = context.complete_tx(tx);
    let result = context.verify_tx(&tx, MAX_CYCLES);
    assert!(result.is_err(), "invalid MIME should fail");
    let msg = format!("{:?}", result.unwrap_err());
    println!("test_create_invalid_mime_fails: {}", msg);
    // Error code 26 = InvalidMimeFormat. But the underscore in "not_a_mime" is
    // not in the allowed set either, so it could also be 26 from the char check.
    // Either way, code 26.
    assert!(
        msg.contains("26") || msg.contains("InvalidMimeFormat"),
        "expected error code 26, got: {}",
        msg
    );
}

// ─── TRANSFER TESTS ──────────────────────────────────────────────────

#[test]
fn test_transfer_description_change_allowed() {
    let (mut context, type_script, lock_script) = setup();

    let original_data =
        build_market_item(b"image/png", b"Original description", &[0xCA, 0xFE]);
    let updated_data =
        build_market_item(b"image/png", b"Updated description", &[0xCA, 0xFE]);

    // Create the input cell (already exists on-chain).
    let input_out_point = context.create_cell(
        CellOutput::new_builder()
            .capacity(CELL_CAPACITY)
            .lock(lock_script.clone())
            .type_(Some(type_script.clone()).pack())
            .build(),
        original_data,
    );
    let input = CellInput::new_builder()
        .previous_output(input_out_point)
        .build();

    let output = CellOutput::new_builder()
        .capacity(CELL_CAPACITY)
        .lock(lock_script)
        .type_(Some(type_script).pack())
        .build();

    let tx = TransactionBuilder::default()
        .input(input)
        .output(output)
        .output_data(updated_data.pack())
        .build();

    let tx = context.complete_tx(tx);
    let cycles = context
        .verify_tx(&tx, MAX_CYCLES)
        .expect("transfer with description change should pass");
    println!("test_transfer_description_change_allowed: {} cycles", cycles);
}

#[test]
fn test_transfer_content_change_fails() {
    let (mut context, type_script, lock_script) = setup();

    let original_data = build_market_item(b"image/png", b"A description", &[0xCA, 0xFE]);
    let modified_data = build_market_item(b"image/png", b"A description", &[0xDE, 0xAD]);

    let input_out_point = context.create_cell(
        CellOutput::new_builder()
            .capacity(CELL_CAPACITY)
            .lock(lock_script.clone())
            .type_(Some(type_script.clone()).pack())
            .build(),
        original_data,
    );
    let input = CellInput::new_builder()
        .previous_output(input_out_point)
        .build();

    let output = CellOutput::new_builder()
        .capacity(CELL_CAPACITY)
        .lock(lock_script)
        .type_(Some(type_script).pack())
        .build();

    let tx = TransactionBuilder::default()
        .input(input)
        .output(output)
        .output_data(modified_data.pack())
        .build();

    let tx = context.complete_tx(tx);
    let result = context.verify_tx(&tx, MAX_CYCLES);
    assert!(result.is_err(), "content change should fail");
    let msg = format!("{:?}", result.unwrap_err());
    println!("test_transfer_content_change_fails: {}", msg);
    assert!(
        msg.contains("25") || msg.contains("ContentChanged"),
        "expected error code 25, got: {}",
        msg
    );
}

#[test]
fn test_transfer_content_type_change_fails() {
    let (mut context, type_script, lock_script) = setup();

    let original_data = build_market_item(b"image/png", b"A description", &[0xCA, 0xFE]);
    let modified_data = build_market_item(b"image/jpeg", b"A description", &[0xCA, 0xFE]);

    let input_out_point = context.create_cell(
        CellOutput::new_builder()
            .capacity(CELL_CAPACITY)
            .lock(lock_script.clone())
            .type_(Some(type_script.clone()).pack())
            .build(),
        original_data,
    );
    let input = CellInput::new_builder()
        .previous_output(input_out_point)
        .build();

    let output = CellOutput::new_builder()
        .capacity(CELL_CAPACITY)
        .lock(lock_script)
        .type_(Some(type_script).pack())
        .build();

    let tx = TransactionBuilder::default()
        .input(input)
        .output(output)
        .output_data(modified_data.pack())
        .build();

    let tx = context.complete_tx(tx);
    let result = context.verify_tx(&tx, MAX_CYCLES);
    assert!(result.is_err(), "content_type change should fail");
    let msg = format!("{:?}", result.unwrap_err());
    println!("test_transfer_content_type_change_fails: {}", msg);
    assert!(
        msg.contains("24") || msg.contains("ContentTypeChanged"),
        "expected error code 24, got: {}",
        msg
    );
}

// ─── BURN TEST ───────────────────────────────────────────────────────

#[test]
fn test_burn_always_allowed() {
    let (mut context, type_script, lock_script) = setup();

    let data = build_market_item(b"image/png", b"A pixel art piece", &[0xDE, 0xAD, 0xBE, 0xEF]);

    // Create an input cell with the type script.
    let input_out_point = context.create_cell(
        CellOutput::new_builder()
            .capacity(CELL_CAPACITY)
            .lock(lock_script.clone())
            .type_(Some(type_script).pack())
            .build(),
        data,
    );
    let input = CellInput::new_builder()
        .previous_output(input_out_point)
        .build();

    // Output has NO type script — this is a burn.
    let output = CellOutput::new_builder()
        .capacity(CELL_CAPACITY)
        .lock(lock_script)
        .build();

    let tx = TransactionBuilder::default()
        .input(input)
        .output(output)
        .output_data(Bytes::new().pack())
        .build();

    let tx = context.complete_tx(tx);
    let cycles = context
        .verify_tx(&tx, MAX_CYCLES)
        .expect("burn should always be allowed");
    println!("test_burn_always_allowed: {} cycles", cycles);
}
