import { ArrowRight, Layers, ShieldCheck, Sparkles, Users } from 'lucide-react';
import Link from 'next/link';
import { Header } from '@/ui/components/Header';
import { Footer } from '@/ui/components/ui';

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <Header />

      <main className="mx-auto max-w-5xl px-5">
        {/* Hero */}
        <section className="grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-800">
              <Sparkles className="h-3.5 w-3.5" />
              One transaction. Everyone paid.
            </span>
            <h1 className="font-display mt-5 text-4xl font-bold leading-[1.05] text-ink sm:text-5xl">
              Your salary lands. <span className="text-brand-700">It splits to everyone</span> who
              counts on it.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-ink-soft">
              Sahod is a cross-border salary splitter. Set the shares once — family back home, your
              savings, a co-worker — and pay them all in a single, verifiable Stellar transaction.
              Default to XLM, switch to USDC in one tap.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/dashboard"
                data-testid="cta-button"
                className="btn-primary inline-flex h-12 items-center gap-2 rounded-full px-6 text-base font-semibold"
              >
                Build your split
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/stats"
                className="btn-ghost inline-flex h-12 items-center rounded-full px-5 text-base font-medium"
              >
                See live activity
              </Link>
            </div>
            <p className="mt-4 text-sm text-ink-soft">
              No sign-up. Connect a Stellar wallet only when you are ready to sign.
            </p>
          </div>

          {/* Split visual — illustrative, generic, not fake users */}
          <div className="card p-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-ink-soft">Incoming paycheck</span>
              <span className="font-display text-2xl font-bold tabular-nums text-ink">
                1,000 <span className="text-base text-ink-soft">XLM</span>
              </span>
            </div>
            <div className="my-5 h-px bg-line" />
            <ul className="space-y-3">
              {[
                { label: 'Family — remittance', pct: 50, tone: 'bg-brand-600' },
                { label: 'Savings vault', pct: 30, tone: 'bg-accent' },
                { label: 'Daily spending', pct: 20, tone: 'bg-ink' },
              ].map((row) => (
                <li key={row.label} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-ink">{row.label}</span>
                      <span className="tabular-nums text-ink-soft">
                        {(1000 * row.pct) / 100} XLM · {row.pct}%
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-paper-deep">
                      <div
                        className={`h-full rounded-full ${row.tone}`}
                        style={{ width: `${row.pct}%` }}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-5 rounded-xl bg-mist px-4 py-3 text-sm text-brand-800">
              Settled with <span className="font-semibold">one signature</span> — funded and fanned
              out atomically by a Soroban contract.
            </div>
          </div>
        </section>

        {/* Value props */}
        <section className="grid gap-4 pb-6 sm:grid-cols-3">
          {[
            {
              icon: Layers,
              title: 'Atomic on-chain split',
              body: 'One signature funds a Soroban contract that pays every recipient in the same call — the whole split clears together or not at all.',
            },
            {
              icon: Users,
              title: 'Real recipients, real addresses',
              body: 'Add the Stellar addresses of the people you support. Sahod stores no fake names — only the wallets you enter.',
            },
            {
              icon: ShieldCheck,
              title: 'Verifiable on-chain',
              body: 'Every XLM split runs through a deployed Soroban contract that writes a permanent receipt. Each run links to its transaction on stellar.expert.',
            },
          ].map((f) => (
            <div key={f.title} className="card p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold text-ink">{f.title}</h3>
              <p className="mt-1.5 text-sm text-ink-soft">{f.body}</p>
            </div>
          ))}
        </section>

        {/* How it works */}
        <section className="card mt-6 p-7">
          <h2 className="font-display text-xl font-bold text-ink">How a split runs</h2>
          <ol className="mt-5 grid gap-5 sm:grid-cols-4">
            {[
              {
                n: '1',
                t: 'Connect',
                d: 'Link your Stellar wallet — pinned to testnet, whatever your wallet network.',
              },
              {
                n: '2',
                t: 'Add recipients',
                d: 'Name each share and paste their Stellar address. Shares total 100%.',
              },
              {
                n: '3',
                t: 'Enter the paycheck',
                d: 'Choose XLM or USDC and the amount that just arrived.',
              },
              {
                n: '4',
                t: 'Pay everyone',
                d: 'Sign once. The Soroban contract funds and fans out the paycheck in a single on-chain call.',
              },
            ].map((s) => (
              <li key={s.n}>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 font-display font-bold text-white">
                  {s.n}
                </div>
                <div className="mt-3 font-semibold text-ink">{s.t}</div>
                <p className="mt-1 text-sm text-ink-soft">{s.d}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <Footer />
    </div>
  );
}
