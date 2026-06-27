import Link from 'next/link';
import type { AssetCode } from '@/ui/lib/format';
import { cn } from '@/ui/lib/format';

export function AssetBadge({ asset }: { asset: AssetCode | string }) {
  const isXlm = asset === 'XLM';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
        isXlm ? 'bg-brand-50 text-brand-800' : 'bg-accent-50 text-accent',
      )}
    >
      {asset}
    </span>
  );
}

export function Footer() {
  return (
    <footer className="mt-20 border-t border-line/70">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-5 py-7 text-sm text-ink-soft sm:flex-row">
        <p>Sahod · one paycheck, split on-chain · Stellar testnet</p>
        <div className="flex items-center gap-4">
          <Link href="/stats" className="hover:text-ink">
            Live stats
          </Link>
          <a href="https://stellar.org" target="_blank" rel="noreferrer" className="hover:text-ink">
            Built on Stellar
          </a>
        </div>
      </div>
    </footer>
  );
}
