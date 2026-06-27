'use client';

import { ArrowRight, Loader2, Plus, Trash2, Users, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Header } from '@/ui/components/Header';
import { AssetBadge, Footer } from '@/ui/components/ui';
import { cn, shortKey } from '@/ui/lib/format';
import { useWallet } from '@/ui/wallet/WalletProvider';

type Recipient = { id: string; label: string; address: string; sharePct: number };
type SplitRow = {
  id: string;
  name: string;
  asset: string;
  recipients: Recipient[];
  runCount: number;
  createdAt: string;
};

async function api(path: string, body?: unknown) {
  const res = await fetch(path, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({ ok: false }));
  if (!json.ok) throw new Error(json.error?.message ?? `Request failed (${res.status})`);
  return json.data;
}

type Draft = { label: string; address: string; share: string };

export default function DashboardPage() {
  const { status, publicKey, connect } = useWallet();
  const router = useRouter();
  const [splits, setSplits] = useState<SplitRow[] | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api('/api/splits');
      setSplits(data.splits);
    } catch {
      setSplits([]);
    }
  }, []);

  useEffect(() => {
    if (status === 'connected') void load();
  }, [status, load]);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-5xl px-5 py-8">
        {status === 'loading' && (
          <div className="card flex items-center gap-3 p-8 text-ink-soft">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading your workspace…
          </div>
        )}

        {status !== 'loading' && status !== 'connected' && (
          <div className="card mx-auto max-w-lg p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
              <Wallet className="h-6 w-6" />
            </div>
            <h1 className="font-display mt-4 text-2xl font-bold text-ink">
              Connect to manage splits
            </h1>
            <p className="mx-auto mt-2 max-w-sm text-ink-soft">
              Your splits live with your wallet. Connect to create one and pay everyone in a single
              on-chain transaction. We pin signing to Stellar testnet.
            </p>
            <button
              type="button"
              data-testid="connect-cta"
              onClick={() => void connect()}
              disabled={status === 'connecting'}
              className="btn-primary mx-auto mt-6 inline-flex h-12 items-center gap-2 rounded-full px-6 font-semibold"
            >
              {status === 'connecting' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wallet className="h-4 w-4" />
              )}
              {status === 'connecting' ? 'Connecting…' : 'Connect wallet'}
            </button>
          </div>
        )}

        {status === 'connected' && (
          <>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="font-display text-3xl font-bold text-ink">My splits</h1>
                <p className="mt-1 text-ink-soft">
                  Signed in as{' '}
                  <span className="tnum font-medium text-ink">{shortKey(publicKey ?? '')}</span>
                </p>
              </div>
              {!showForm && (
                <button
                  type="button"
                  data-testid="new-split-button"
                  onClick={() => setShowForm(true)}
                  className="btn-primary inline-flex h-11 items-center gap-2 rounded-full px-5 font-semibold"
                >
                  <Plus className="h-4 w-4" />
                  New split
                </button>
              )}
            </div>

            {showForm && (
              <CreateSplitForm
                onCancel={() => setShowForm(false)}
                onCreated={(id) => router.push(`/splits/${id}`)}
              />
            )}

            <div className="mt-7">
              {splits === null ? (
                <div className="card flex items-center gap-3 p-8 text-ink-soft">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Loading splits…
                </div>
              ) : splits.length === 0 ? (
                !showForm && (
                  <div className="card p-10 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-mist text-brand-700">
                      <Users className="h-6 w-6" />
                    </div>
                    <h2 className="font-display mt-4 text-xl font-semibold text-ink">
                      No splits yet
                    </h2>
                    <p className="mx-auto mt-2 max-w-sm text-ink-soft">
                      Create your first split — name each share, add the recipients’ Stellar
                      addresses, and you are ready to pay them all at once.
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowForm(true)}
                      className="btn-primary mx-auto mt-6 inline-flex h-11 items-center gap-2 rounded-full px-5 font-semibold"
                    >
                      <Plus className="h-4 w-4" />
                      Create a split
                    </button>
                  </div>
                )
              ) : (
                <ul className="grid gap-4 sm:grid-cols-2">
                  {splits.map((s) => (
                    <li key={s.id}>
                      <Link
                        href={`/splits/${s.id}`}
                        data-testid="split-card"
                        className="card block p-5 transition hover:border-brand-100"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="font-display text-lg font-semibold text-ink">{s.name}</h3>
                          <AssetBadge asset={s.asset} />
                        </div>
                        <p className="mt-1 text-sm text-ink-soft">
                          {s.recipients.length} recipients · {s.runCount} payout
                          {s.runCount === 1 ? '' : 's'}
                        </p>
                        <div className="mt-4 flex items-center gap-1.5">
                          {s.recipients.slice(0, 5).map((r) => (
                            <span
                              key={r.id}
                              title={`${r.label} · ${r.sharePct}%`}
                              className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-[11px] font-bold text-brand-800"
                            >
                              {r.sharePct}
                            </span>
                          ))}
                        </div>
                        <div className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-700">
                          Open split
                          <ArrowRight className="h-4 w-4" />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}

function CreateSplitForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState('');
  const [asset, setAsset] = useState<'XLM' | 'USDC'>('XLM');
  const [rows, setRows] = useState<Draft[]>([
    { label: '', address: '', share: '50' },
    { label: '', address: '', share: '50' },
  ]);
  const [saving, setSaving] = useState(false);

  const total = rows.reduce((a, r) => a + (Number(r.share) || 0), 0);

  function update(i: number, patch: Partial<Draft>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setRows((rs) => [...rs, { label: '', address: '', share: '0' }]);
  }
  function removeRow(i: number) {
    setRows((rs) => (rs.length <= 2 ? rs : rs.filter((_, idx) => idx !== i)));
  }

  async function submit() {
    if (!name.trim()) return toast.error('Name your split');
    if (total !== 100) return toast.error(`Shares must total 100% (currently ${total}%)`);
    setSaving(true);
    try {
      const split = await api('/api/splits', {
        name: name.trim(),
        asset,
        recipients: rows.map((r) => ({
          label: r.label.trim(),
          address: r.address.trim(),
          sharePct: Number(r.share),
        })),
      });
      toast.success('Split created');
      onCreated(split.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create split');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      data-testid="create-split-form"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="card mt-6 p-6"
    >
      <h2 className="font-display text-xl font-bold text-ink">New split</h2>
      <p className="mt-1 text-sm text-ink-soft">Name it, pick an asset, and add who gets what.</p>

      <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="block">
          <span className="text-sm font-medium text-ink">Split name</span>
          <input
            data-testid="split-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Monthly paycheck"
            maxLength={48}
            className="field mt-1.5"
          />
        </label>
        <div>
          <span className="text-sm font-medium text-ink">Asset</span>
          <div className="mt-1.5 inline-flex rounded-xl border border-line bg-white p-1">
            {(['XLM', 'USDC'] as const).map((a) => (
              <button
                key={a}
                type="button"
                data-testid={`asset-${a}`}
                onClick={() => setAsset(a)}
                className={cn(
                  'rounded-lg px-4 py-2 text-sm font-semibold transition',
                  asset === a ? 'bg-brand-600 text-white' : 'text-ink-soft hover:text-ink',
                )}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
      </div>
      {asset === 'USDC' && (
        <p className="mt-2 text-xs text-ink-soft">
          USDC requires each recipient to hold a USDC trustline. XLM works for any funded wallet.
        </p>
      )}

      <div className="mt-6 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-ink">Recipients</span>
          <span
            className={cn(
              'rounded-full px-2.5 py-0.5 text-xs font-semibold',
              total === 100 ? 'bg-brand-50 text-brand-800' : 'bg-accent-50 text-accent',
            )}
          >
            {total}% allocated
          </span>
        </div>

        {rows.map((r, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: positional draft inputs, index is the stable identity
            key={i}
            className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1.6fr_auto_auto] sm:items-center"
          >
            <input
              data-testid={`recipient-label-${i}`}
              value={r.label}
              onChange={(e) => update(i, { label: e.target.value })}
              placeholder="Label (e.g. Family)"
              maxLength={40}
              className="field"
            />
            <input
              data-testid={`recipient-address-${i}`}
              value={r.address}
              onChange={(e) => update(i, { address: e.target.value })}
              placeholder="G… Stellar address"
              className="field font-mono text-sm"
            />
            <div className="flex items-center gap-1">
              <input
                data-testid={`recipient-share-${i}`}
                value={r.share}
                inputMode="numeric"
                onChange={(e) =>
                  update(i, { share: e.target.value.replace(/[^0-9]/g, '').slice(0, 3) })
                }
                className="field w-20 text-center tnum"
                aria-label={`Share percent for recipient ${i + 1}`}
              />
              <span className="text-ink-soft">%</span>
            </div>
            <button
              type="button"
              onClick={() => removeRow(i)}
              disabled={rows.length <= 2}
              aria-label="Remove recipient"
              className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-soft transition hover:bg-mist disabled:opacity-30"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}

        <button
          type="button"
          data-testid="add-recipient"
          onClick={addRow}
          className="btn-ghost inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-medium"
        >
          <Plus className="h-4 w-4" />
          Add recipient
        </button>
      </div>

      <div className="mt-7 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="btn-ghost inline-flex h-11 items-center rounded-full px-5 text-sm font-medium"
        >
          Cancel
        </button>
        <button
          type="submit"
          data-testid="submit-split"
          disabled={saving}
          className="btn-primary inline-flex h-11 items-center gap-2 rounded-full px-6 text-sm font-semibold"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Create split
        </button>
      </div>
    </form>
  );
}
