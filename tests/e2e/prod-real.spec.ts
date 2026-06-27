import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { type BrowserContext, chromium, expect, type Locator, type Page, test } from '@playwright/test';
import { Keypair } from '@stellar/stellar-sdk';
import {
  approveOnce,
  cleanup,
  FREIGHTER,
  getExtensionId,
  launchWithFreighter,
  onboardFreighter,
} from '../../../../../shared/freighter/freighter-fixture';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'https://sahod-sandy.vercel.app';

const SHOTS = path.resolve(__dirname, '../../../screen-shot');
mkdirSync(SHOTS, { recursive: true });
const shot = (name: string) => path.join(SHOTS, name);
const pageShot = (page: Page, name: string) =>
  page.screenshot({ path: shot(name), type: 'jpeg', quality: 85 });

const APPROVAL_ROUTES = ['grant-access', 'sign-transaction', 'sign-auth-entry', 'sign-message'];
const APPROVE_BUTTONS = [
  'grant-access-connect-button',
  'sign-transaction-sign',
  'sign-auth-entry-approve-button',
  'sign-message-approve-button',
];

test.describe.configure({ mode: 'serial' });

let context: BrowserContext;
let userDataDir: string;

test.beforeAll(async () => {
  const launched = await launchWithFreighter(chromium);
  context = launched.context;
  userDataDir = launched.userDataDir;
  await ensureOnboarded();
});

test.afterAll(async () => {
  if (context) await cleanup(context, userDataDir);
});

async function openExtensionHome(): Promise<Page> {
  const id = getExtensionId(context);
  const page = await context.newPage();
  await page.goto(`chrome-extension://${id}/index.html#/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  return page;
}

async function warmServiceWorker(): Promise<void> {
  const page = await openExtensionHome();
  const welcome = page.getByRole('button', { name: /I already have a wallet/i });
  const home = page.locator('[data-testid=network-selector-open]');
  const locked = page.locator('input[type=password]').first();
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (await welcome.isVisible().catch(() => false)) break;
    if (await home.isVisible().catch(() => false)) break;
    if (await locked.isVisible().catch(() => false)) break;
    await page.waitForTimeout(500);
  }
  await page.close().catch(() => {});
}

async function isUnlockedDeployerHome(): Promise<boolean> {
  const page = await openExtensionHome();
  const welcome = page.getByRole('button', { name: /I already have a wallet/i });
  if (await welcome.isVisible().catch(() => false)) {
    await page.close().catch(() => {});
    return false;
  }
  const locked = page.locator('input[type=password]').first();
  if (await locked.isVisible().catch(() => false)) {
    await locked.fill(FREIGHTER.password).catch(() => {});
    await page.keyboard.press('Enter').catch(() => {});
    await page.waitForTimeout(2000);
  }
  const home = page.locator('[data-testid=network-selector-open]');
  const ready = await home.isVisible().catch(() => false);
  await page.close().catch(() => {});
  return ready;
}

async function ensureOnboarded(): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt++) {
    await warmServiceWorker();
    await onboardFreighter(context).catch(() => {});
    if (await isUnlockedDeployerHome()) return;
  }
  throw new Error('Freighter never reached the unlocked deployer home after retries');
}

function findApprovalPopup(): Page | null {
  const prefix = `chrome-extension://${getExtensionId(context)}`;
  for (const p of context.pages()) {
    if (p.isClosed() || !p.url().startsWith(prefix)) continue;
    if (APPROVAL_ROUTES.some((route) => p.url().includes(route))) return p;
  }
  return null;
}

async function popupHasApproveButton(popup: Page): Promise<boolean> {
  for (const tid of APPROVE_BUTTONS) {
    const btn = popup.locator(`[data-testid=${tid}]`).first();
    if ((await btn.isVisible().catch(() => false)) === true) return true;
  }
  return false;
}

async function captureApprovalPopup(file: string, ms: number): Promise<void> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const popup = findApprovalPopup();
    if (popup && (await popupHasApproveButton(popup))) {
      await popup.waitForTimeout(400);
      await popup.screenshot({ path: file, type: 'jpeg', quality: 85 }).catch(() => {});
      return;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
}

function walletPill(page: Page) {
  return page.getByTestId('wallet-pill');
}

async function connectWallet(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (await walletPill(page).isVisible().catch(() => false)) return;
    await page.getByTestId('connect-cta').click();
    if (attempt === 0) await captureApprovalPopup(shot('02-connect-popup.jpg'), 20_000);
    await approveOnce(context, { timeout: 60_000 }).catch(() => {});
    await approveOnce(context, { timeout: 90_000 }).catch(() => {});
    if (await walletPill(page).isVisible({ timeout: 25_000 }).catch(() => false)) return;
  }
  await expect(walletPill(page)).toBeVisible({ timeout: 20_000 });
}

async function createXlmSplit(page: Page, recipients: string[]): Promise<void> {
  await page.getByTestId('new-split-button').click();
  await expect(page.getByTestId('create-split-form')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('split-name').fill('Real-Freighter paycheck');
  await page.getByTestId('asset-XLM').click();
  await page.getByTestId('recipient-label-0').fill('Family back home');
  await page.getByTestId('recipient-address-0').fill(recipients[0]);
  await page.getByTestId('recipient-share-0').fill('60');
  await page.getByTestId('recipient-label-1').fill('Savings');
  await page.getByTestId('recipient-address-1').fill(recipients[1]);
  await page.getByTestId('recipient-share-1').fill('40');
  await pageShot(page, '03-create-split.jpg');
  await page.getByTestId('submit-split').click();
}

async function awaitRunOutcome(page: Page, payBtn: Locator, txLink: Locator): Promise<'ok' | 'retry'> {
  const deadline = Date.now() + 160_000;
  await page.waitForTimeout(2000);
  while (Date.now() < deadline) {
    if (await txLink.isVisible().catch(() => false)) return 'ok';
    await approveOnce(context, { timeout: 6_000 }).catch(() => {});
    if (await txLink.isVisible().catch(() => false)) return 'ok';
    if (await payBtn.isEnabled().catch(() => false)) {
      await page.waitForTimeout(1500);
      if (await txLink.isVisible().catch(() => false)) return 'ok';
      if (await payBtn.isEnabled().catch(() => false)) return 'retry';
    }
    await page.waitForTimeout(1000);
  }
  return 'retry';
}

async function runSplitForTxHash(page: Page): Promise<string> {
  await expect(page.getByTestId('paycheck-amount')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('paycheck-amount').fill('5');
  await expect(page.getByTestId('preview')).toBeVisible();
  const payBtn = page.getByTestId('pay-button');
  const txLink = page.locator('[data-testid="run-list"] a[href*="stellar.expert"]').first();
  for (let attempt = 0; attempt < 4; attempt++) {
    await expect(payBtn).toBeEnabled({ timeout: 30_000 });
    await payBtn.click();
    if (attempt === 0) await captureApprovalPopup(shot('04-sign-popup.jpg'), 25_000);
    if ((await awaitRunOutcome(page, payBtn, txLink)) === 'ok') {
      const href = await txLink.getAttribute('href');
      return href ?? '';
    }
  }
  throw new Error('salary split never produced an on-chain tx after retries');
}

async function fundRecipients(): Promise<string[]> {
  const pair = [Keypair.random(), Keypair.random()];
  await Promise.all(pair.map((kp) => friendbot(kp.publicKey())));
  return pair.map((kp) => kp.publicKey());
}

async function friendbot(pubkey: string): Promise<void> {
  const res = await fetch(`https://friendbot.stellar.org/?addr=${pubkey}`);
  if (!res.ok && res.status !== 400) throw new Error(`friendbot failed: ${res.status}`);
}

test('real Freighter: SEP-10 connect + on-chain salary split -> real tx hash', async () => {
  test.setTimeout(360_000);
  const recipients = await fundRecipients();
  const page = await context.newPage();

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('cta-button')).toBeVisible({ timeout: 20_000 });
  await pageShot(page, '01-landing.jpg');

  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('connect-cta')).toBeVisible({ timeout: 20_000 });
  await connectWallet(page);

  await expect(walletPill(page)).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(1500);

  await createXlmSplit(page, recipients);

  const txHref = await runSplitForTxHash(page);
  expect(txHref).toContain('/tx/');
  expect(txHref).toMatch(/stellar\.expert\/explorer\/testnet\/tx\/[0-9a-f]{64}/);
  await pageShot(page, '05-success.jpg');

  await page.goto(`${BASE_URL}/stats`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Sahod in numbers')).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(1500);
  await pageShot(page, '06-stats.jpg');

  const txHash = (txHref ?? '').split('/tx/')[1];
  expect(txHash).toMatch(/^[0-9a-f]{64}$/);
  // biome-ignore lint/suspicious/noConsole: surface the real tx hash for the convert report
  console.log('PROD_TX_HASH=' + txHash);
});

test('mobile landing renders', async () => {
  const page = await context.newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('cta-button')).toBeVisible({ timeout: 20_000 });
  await pageShot(page, '07-mobile.jpg');
});
