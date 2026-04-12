#![no_std]
#![cfg_attr(not(test), no_main)]

#[cfg(test)]
extern crate alloc;

mod entry;
mod error;
mod generated;

use ckb_std::default_alloc;
default_alloc!();

ckb_std::entry!(program_entry);

fn program_entry() -> i8 {
    match entry::main() {
        Ok(()) => 0,
        Err(err) => err as i8,
    }
}
