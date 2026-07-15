'use client';

import { Layers, LogIn, Send, Users, Wallet } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Header } from '@/ui/components/Header';
import { Footer } from '@/ui/components/ui';

type Stats = {
  uniqueWallets: number;
  logins: number;
  totalSplits: number;
  payoutRuns: number;
  recipientsPaid: number;
};

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch('/api/stats')
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setStats(j.data);
        else setFailed(true);
      })
      .catch(() => setFailed(true));
  }, []);

  const cards = [
    {
      icon: Wallet,
      label: 'Wallets connected',
      value: stats?.uniqueWallets,
      hint: 'unique SEP-10 wallets',
    },
    { icon: LogIn, label: 'Sessions', value: stats?.logins, hint: 'verified sign-ins' },
    {
      icon: Layers,
      label: 'Splits created',
      value: stats?.totalSplits,
      hint: 'salary plans built',
    },
    { icon: Send, label: 'Payout runs', value: stats?.payoutRuns, hint: 'on-chain transactions' },
    {
      icon: Users,
      label: 'Recipients paid',
      value: stats?.recipientsPaid,
      hint: 'individual payments',
    },
  ];

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-5xl px-5 py-10">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Live network</p>
        <h1 className="font-display mt-1 text-3xl font-bold text-ink">Sahod in numbers</h1>
        <p className="mt-2 max-w-xl text-ink-soft">
          Real interaction counts from the live app — every figure comes from actual wallet sessions
          and on-chain splits. No demo data.
        </p>

        {failed ? (
          <div className="card mt-8 p-8 text-center text-ink-soft">
            Stats are unavailable right now.
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((c) => (
              <div key={c.label} className="card p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                  <c.icon className="h-5 w-5" />
                </div>
                <div className="mt-4 font-display text-4xl font-bold tabular-nums text-ink">
                  {stats ? c.value : '—'}
                </div>
                <div className="mt-1 font-medium text-ink">{c.label}</div>
                <div className="text-sm text-ink-soft">{c.hint}</div>
              </div>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
