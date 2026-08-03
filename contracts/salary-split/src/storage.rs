use soroban_sdk::{contracttype, BytesN};

/// Storage keys. `SplitReceipt` rows live in *persistent* storage (they are a
/// permanent ledger and must outlive the contract instance), while the admin,
/// token, counters and pause flag share the instance TTL.
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Token,
    Paused,
    /// Number of split runs settled.
    Count,
    /// Lifetime total paid through the contract, in token minor units.
    TotalOut,
    /// split_ref -> SplitReceipt
    Receipt(BytesN<32>),
}

// Soroban ledgers close ~every 5s -> 17,280 ledgers/day.
pub const DAY_IN_LEDGERS: u32 = 17_280;

// Keep the instance (admin/config/counters) alive ~30 days, re-bumped on writes.
pub const INSTANCE_BUMP_AMOUNT: u32 = 30 * DAY_IN_LEDGERS;
pub const INSTANCE_LIFETIME_THRESHOLD: u32 = INSTANCE_BUMP_AMOUNT - DAY_IN_LEDGERS;

// Receipt rows are bumped to ~90 days so the public ledger of receipts does not
// expire out from under an auditor checking an old payout.
pub const RECEIPT_BUMP_AMOUNT: u32 = 90 * DAY_IN_LEDGERS;
pub const RECEIPT_LIFETIME_THRESHOLD: u32 = RECEIPT_BUMP_AMOUNT - DAY_IN_LEDGERS;
