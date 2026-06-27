use soroban_sdk::contracterror;

/// Every failure mode is an explicit, contiguous `u32` so the TypeScript client
/// can map a contract error straight to a user-facing message without guessing.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    NotAuthorized = 3,
    Paused = 4,
    /// An individual share, or the computed total, was not strictly positive.
    InvalidAmount = 5,
    /// recipients.len() != amounts.len(), or there were zero / too many lines.
    InvalidSplit = 6,
    /// This `split_ref` was already settled — a run can never be paid twice.
    AlreadyPaid = 7,
    /// No receipt exists for the requested `split_ref`.
    ReceiptNotFound = 8,
}
