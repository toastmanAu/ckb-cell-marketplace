CONTRACT_DIR = contracts/market-item-type
BUILD_DIR = build

.PHONY: build clean test fmt clippy

build:
	mkdir -p $(BUILD_DIR)
	cd $(CONTRACT_DIR) && cargo build --release
	cp $(CONTRACT_DIR)/target/riscv64imac-unknown-none-elf/release/market-item-type $(BUILD_DIR)/

clean:
	cd $(CONTRACT_DIR) && cargo clean
	rm -rf $(BUILD_DIR)

test:
	cd tests && cargo test -- --nocapture

fmt:
	cd $(CONTRACT_DIR) && cargo fmt
	cd tests && cargo fmt

clippy:
	cd $(CONTRACT_DIR) && cargo clippy -- -D warnings
