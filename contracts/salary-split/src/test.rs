#![cfg(test)]

use crate::{Error, SalarySplit, SalarySplitClient};
use soroban_sdk::{
    testutils::{Address as _, BytesN as _},
    token::{StellarAssetClient, TokenClient},
    vec, Address, BytesN, Env, Vec,
};

struct Harness {
    env: Env,
    admin: Address,
    payer: Address,
    r1: Address,
    r2: Address,
    token: Address,
    split: SalarySplitClient<'static>,
}

fn setup() -> Harness {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let payer = Address::generate(&env);
    let r1 = Address::generate(&env);
    let r2 = Address::generate(&env);

    // Register a SAC token (stands in for native XLM) and fund the payer.
    let issuer = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(issuer);
    let token = sac.address();
    StellarAssetClient::new(&env, &token).mint(&payer, &1_000_000_000);

    let contract_id = env.register(SalarySplit, ());
    let split = SalarySplitClient::new(&env, &contract_id);
    split.initialize(&admin, &token);

    Harness { env, admin, payer, r1, r2, token, split }
}

fn split_ref(env: &Env) -> BytesN<32> {
    BytesN::random(env)
}

fn recipients(h: &Harness) -> Vec<Address> {
    vec![&h.env, h.r1.clone(), h.r2.clone()]
}

#[test]
fn test_initialize_sets_admin_and_token() {
    let h = setup();
    assert_eq!(h.split.get_admin(), h.admin);
    assert_eq!(h.split.get_token(), h.token);
    assert_eq!(h.split.total_paid(), 0);
    assert_eq!(h.split.total_splits(), 0);
    assert_eq!(h.split.is_paused(), false);
}

#[test]
fn test_initialize_twice_fails() {
    let h = setup();
    let res = h.split.try_initialize(&h.admin, &h.token);
    assert_eq!(res, Err(Ok(Error::AlreadyInitialized)));
}

#[test]
fn test_pay_split_fans_out_atomically() {
    let h = setup();
    let token = TokenClient::new(&h.env, &h.token);
    let r = split_ref(&h.env);

    // 5 XLM split 60/40 -> 3 XLM + 2 XLM.
    let amounts = vec![&h.env, 30_000_000i128, 20_000_000i128];
    let total = h.split.pay_split(&r, &h.payer, &recipients(&h), &amounts);

    assert_eq!(total, 50_000_000);
    // Payer funded the whole paycheck.
    assert_eq!(token.balance(&h.payer), 1_000_000_000 - 50_000_000);
    // Each recipient got their exact share.
    assert_eq!(token.balance(&h.r1), 30_000_000);
    assert_eq!(token.balance(&h.r2), 20_000_000);
    // The contract is a pure pass-through: it holds nothing afterwards.
    assert_eq!(token.balance(&h.split.address), 0);

    // Counters + permanent receipt.
    assert_eq!(h.split.total_paid(), 50_000_000);
    assert_eq!(h.split.total_splits(), 1);
    assert_eq!(h.split.is_paid(&r), true);
    let receipt = h.split.get_receipt(&r);
    assert_eq!(receipt.payer, h.payer);
    assert_eq!(receipt.total, 50_000_000);
    assert_eq!(receipt.recipients, 2);
}

#[test]
fn test_pay_split_length_mismatch_fails() {
    let h = setup();
    let r = split_ref(&h.env);
    let amounts = vec![&h.env, 10_000_000i128]; // 1 amount, 2 recipients
    let res = h.split.try_pay_split(&r, &h.payer, &recipients(&h), &amounts);
    assert_eq!(res, Err(Ok(Error::InvalidSplit)));
}

#[test]
fn test_pay_split_empty_recipients_fails() {
    let h = setup();
    let r = split_ref(&h.env);
    let none: Vec<Address> = Vec::new(&h.env);
    let amounts: Vec<i128> = Vec::new(&h.env);
    let res = h.split.try_pay_split(&r, &h.payer, &none, &amounts);
    assert_eq!(res, Err(Ok(Error::InvalidSplit)));
}

#[test]
fn test_pay_split_zero_or_negative_share_fails() {
    let h = setup();
    let r = split_ref(&h.env);
    let amounts = vec![&h.env, 30_000_000i128, 0i128];
    assert_eq!(
        h.split.try_pay_split(&r, &h.payer, &recipients(&h), &amounts),
        Err(Ok(Error::InvalidAmount))
    );
    let neg = vec![&h.env, 30_000_000i128, -1i128];
    assert_eq!(
        h.split.try_pay_split(&r, &h.payer, &recipients(&h), &neg),
        Err(Ok(Error::InvalidAmount))
    );
}

#[test]
fn test_double_pay_same_ref_fails() {
    let h = setup();
    let r = split_ref(&h.env);
    let amounts = vec![&h.env, 30_000_000i128, 20_000_000i128];
    h.split.pay_split(&r, &h.payer, &recipients(&h), &amounts);
    // The same run reference can never settle twice.
    let res = h.split.try_pay_split(&r, &h.payer, &recipients(&h), &amounts);
    assert_eq!(res, Err(Ok(Error::AlreadyPaid)));
}

#[test]
fn test_get_unknown_receipt_fails() {
    let h = setup();
    let r = split_ref(&h.env);
    assert_eq!(h.split.is_paid(&r), false);
    assert_eq!(h.split.try_get_receipt(&r), Err(Ok(Error::ReceiptNotFound)));
}

#[test]
fn test_paused_blocks_pay_split() {
    let h = setup();
    let r = split_ref(&h.env);
    let amounts = vec![&h.env, 30_000_000i128, 20_000_000i128];

    h.split.pause();
    assert_eq!(h.split.is_paused(), true);
    assert_eq!(
        h.split.try_pay_split(&r, &h.payer, &recipients(&h), &amounts),
        Err(Ok(Error::Paused))
    );

    h.split.unpause();
    // Unpaused — the split now settles.
    h.split.pay_split(&r, &h.payer, &recipients(&h), &amounts);
    assert_eq!(h.split.is_paid(&r), true);
}

#[test]
fn test_two_distinct_splits_accumulate() {
    let h = setup();
    let amounts = vec![&h.env, 10_000_000i128, 10_000_000i128];
    h.split.pay_split(&split_ref(&h.env), &h.payer, &recipients(&h), &amounts);
    h.split.pay_split(&split_ref(&h.env), &h.payer, &recipients(&h), &amounts);
    assert_eq!(h.split.total_splits(), 2);
    assert_eq!(h.split.total_paid(), 40_000_000);
}
