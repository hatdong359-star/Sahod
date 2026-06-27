#![no_std]
//! # Sahod Salary Split
//!
//! A Soroban smart contract that turns one incoming paycheck into a single,
//! atomic, on-chain fan-out to everyone who depends on it.
//!
//! The whole point is atomicity: a classic "loop of payments" can land halfway —
//! family paid, savings dropped. Sahod's `pay_split` does the pay-in and every
//! payout **inside one contract invocation**, so the run clears completely or
//! reverts completely. There is no half-sent paycheck.
//!
//! ## Lifecycle
//!
//! 1. **initialize(admin, token)** — one-time. Records the operator (admin) and
//!    the pool's Stellar Asset Contract (SAC) token. Sahod initializes this with
//!    native XLM's SAC, so payers need no trustline.
//! 2. **pay_split(split_ref, payer, recipients, amounts)** — the payer signs ONE
//!    transaction. Inside the call the contract:
//!      a. pulls `total = sum(amounts)` from the payer into its own custody
//!         (SAC transfer payer -> contract), then
//!      b. immediately pays every recipient their share
//!         (SAC transfer contract -> recipient), then
//!      c. writes a permanent `SplitReceipt` keyed by `split_ref`.
//!    All three happen atomically. The contract never holds a float: whatever
//!    came in goes straight back out in the same call.
//!
//! ## Design notes
//! - **Pay-in + split-out in one invoke.** The contract takes custody of the
//!   total and disburses it in the same call — the on-chain guarantee that the
//!   split is all-or-nothing.
//! - **Receipt-keyed, double-pay-proof.** Each receipt is keyed by a 32-byte
//!   `split_ref` (sha256 of Sahod's run id) so the same run can never settle
//!   twice and any auditor can read who funded what, when.
//! - **Authorization.** `pay_split` requires the *payer's* signature, which also
//!   authorizes the inner pay-in transfer. No admin gate on payouts — a payer
//!   moves only their own money to addresses they chose.
//! - **Pausable + upgradeable.** Operational safety for a mainnet (L6) deploy.

mod error;
mod storage;
mod types;

#[cfg(test)]
mod test;

pub use error::Error;
use storage::{
    DataKey, INSTANCE_BUMP_AMOUNT, INSTANCE_LIFETIME_THRESHOLD, RECEIPT_BUMP_AMOUNT,
    RECEIPT_LIFETIME_THRESHOLD,
};
pub use types::SplitReceipt;

use soroban_sdk::{
    contract, contractimpl, symbol_short, token, Address, BytesN, Env, Vec,
};

/// Hard cap on recipients per run — keeps a single invocation within resource
/// limits and matches the app's create-split form (2..=20 lines).
const MAX_RECIPIENTS: u32 = 20;

#[contract]
pub struct SalarySplit;

#[contractimpl]
impl SalarySplit {
    /// One-time setup. Records the admin and the pool's SAC token, then unpauses.
    pub fn initialize(env: Env, admin: Address, token: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::Paused, &false);
        env.storage().instance().set(&DataKey::Count, &0u64);
        env.storage().instance().set(&DataKey::TotalOut, &0i128);
        bump_instance(&env);
        env.events().publish((symbol_short!("init"),), admin);
        Ok(())
    }

    /// Atomically fund and fan out one paycheck.
    ///
    /// `payer` pays `sum(amounts)` into the contract, which then pays each
    /// `recipients[i]` exactly `amounts[i]` — all in this single call. Writes a
    /// permanent receipt under `split_ref`. Returns the total moved.
    ///
    /// Auth: the payer's signature (covers the inner pay-in transfer).
    pub fn pay_split(
        env: Env,
        split_ref: BytesN<32>,
        payer: Address,
        recipients: Vec<Address>,
        amounts: Vec<i128>,
    ) -> Result<i128, Error> {
        payer.require_auth();
        require_not_paused(&env)?;

        let n = recipients.len();
        if n == 0 || n > MAX_RECIPIENTS || n != amounts.len() {
            return Err(Error::InvalidSplit);
        }
        if env
            .storage()
            .persistent()
            .has(&DataKey::Receipt(split_ref.clone()))
        {
            return Err(Error::AlreadyPaid);
        }

        // Sum the shares, rejecting any non-positive line.
        let mut total: i128 = 0;
        for amount in amounts.iter() {
            if amount <= 0 {
                return Err(Error::InvalidAmount);
            }
            total += amount;
        }
        if total <= 0 {
            return Err(Error::InvalidAmount);
        }

        let token = token_address(&env)?;
        let client = token::Client::new(&env, &token);
        let contract = env.current_contract_address();

        // (a) Pay-in: pull the whole paycheck into the contract's custody.
        client.transfer(&payer, &contract, &total);

        // (b) Split-out: pay every recipient their exact share from custody.
        for i in 0..n {
            let to = recipients.get_unchecked(i);
            let amount = amounts.get_unchecked(i);
            client.transfer(&contract, &to, &amount);
        }

        // (c) Permanent receipt — written once, never mutated.
        let receipt = SplitReceipt {
            payer: payer.clone(),
            total,
            recipients: n,
            ledger: env.ledger().sequence(),
        };
        save_receipt(&env, &split_ref, &receipt);

        let count: u64 = env.storage().instance().get(&DataKey::Count).unwrap_or(0);
        env.storage().instance().set(&DataKey::Count, &(count + 1));
        let out: i128 = env.storage().instance().get(&DataKey::TotalOut).unwrap_or(0);
        env.storage().instance().set(&DataKey::TotalOut, &(out + total));
        bump_instance(&env);

        env.events()
            .publish((symbol_short!("split"), split_ref), (payer, total, n));
        Ok(total)
    }

    // --- Views -------------------------------------------------------------

    pub fn get_receipt(env: Env, split_ref: BytesN<32>) -> Result<SplitReceipt, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Receipt(split_ref))
            .ok_or(Error::ReceiptNotFound)
    }

    pub fn is_paid(env: Env, split_ref: BytesN<32>) -> bool {
        env.storage()
            .persistent()
            .has(&DataKey::Receipt(split_ref))
    }

    pub fn total_paid(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::TotalOut).unwrap_or(0)
    }

    pub fn total_splits(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::Count).unwrap_or(0)
    }

    pub fn is_paused(env: Env) -> bool {
        env.storage().instance().get(&DataKey::Paused).unwrap_or(false)
    }

    pub fn get_admin(env: Env) -> Result<Address, Error> {
        stored_admin(&env)
    }

    pub fn get_token(env: Env) -> Result<Address, Error> {
        token_address(&env)
    }

    // --- Admin -------------------------------------------------------------

    pub fn pause(env: Env) -> Result<(), Error> {
        stored_admin(&env)?.require_auth();
        env.storage().instance().set(&DataKey::Paused, &true);
        bump_instance(&env);
        env.events().publish((symbol_short!("pause"),), true);
        Ok(())
    }

    pub fn unpause(env: Env) -> Result<(), Error> {
        stored_admin(&env)?.require_auth();
        env.storage().instance().set(&DataKey::Paused, &false);
        bump_instance(&env);
        env.events().publish((symbol_short!("pause"),), false);
        Ok(())
    }

    pub fn set_admin(env: Env, new_admin: Address) -> Result<(), Error> {
        stored_admin(&env)?.require_auth();
        env.storage().instance().set(&DataKey::Admin, &new_admin);
        bump_instance(&env);
        Ok(())
    }

    /// Replace the contract's own code (admin-gated). Lets Sahod ship fixes
    /// without migrating receipt state — important for a mainnet (L6) deploy.
    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) -> Result<(), Error> {
        stored_admin(&env)?.require_auth();
        env.deployer().update_current_contract_wasm(new_wasm_hash);
        Ok(())
    }
}

// --- Internal helpers ------------------------------------------------------

fn stored_admin(env: &Env) -> Result<Address, Error> {
    env.storage()
        .instance()
        .get(&DataKey::Admin)
        .ok_or(Error::NotInitialized)
}

fn token_address(env: &Env) -> Result<Address, Error> {
    env.storage()
        .instance()
        .get(&DataKey::Token)
        .ok_or(Error::NotInitialized)
}

fn require_not_paused(env: &Env) -> Result<(), Error> {
    let paused: bool = env
        .storage()
        .instance()
        .get(&DataKey::Paused)
        .ok_or(Error::NotInitialized)?;
    if paused {
        return Err(Error::Paused);
    }
    Ok(())
}

fn save_receipt(env: &Env, split_ref: &BytesN<32>, receipt: &SplitReceipt) {
    let key = DataKey::Receipt(split_ref.clone());
    env.storage().persistent().set(&key, receipt);
    env.storage()
        .persistent()
        .extend_ttl(&key, RECEIPT_LIFETIME_THRESHOLD, RECEIPT_BUMP_AMOUNT);
}

fn bump_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
}
