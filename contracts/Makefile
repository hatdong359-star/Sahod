.PHONY: test build optimize lint clean

test:
	cargo +1.89.0 test

build:
	cargo +1.89.0 build --release --target wasm32-unknown-unknown

optimize:
	stellar contract optimize --wasm target/wasm32-unknown-unknown/release/salary_split.wasm

lint:
	cargo +1.89.0 clippy -- -D warnings

clean:
	cargo clean
