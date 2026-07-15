use soroban_sdk::{contracttype, Address};

/// A single immutable split receipt. Written exactly once per `split_ref` and
/// never mutated: the permanent on-chain proof that one paycheck was fanned out
/// to every recipient inside a single atomic contract call.
///
/// `split_ref` (the storage key) is sha256 of Sahod's run reference (32 bytes),
/// so the app can address a receipt directly and the same run can never be paid
/// twice.
#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SplitReceipt {
    /// The wallet that funded the split (the paycheck owner).
    pub payer: Address,
    /// Total paid in, in the token's minor units (stroops for XLM; 7 decimals).
    pub total: i128,
    /// How many recipients were paid in this run.
    pub recipients: u32,
    /// Ledger sequence the split settled on (proof-of-time).
    pub ledger: u32,
}
