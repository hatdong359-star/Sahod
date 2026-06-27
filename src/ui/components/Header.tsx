'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/ui/lib/format';
import { ConnectButton } from './ConnectButton';
import { Wordmark } from './Logo';

const NAV = [
  { href: '/dashboard', label: 'My splits' },
  { href: '/stats', label: 'Stats' },
];

export function Header() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-paper/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-3.5">
        <Link href="/" className="shrink-0" aria-label="Sahod home">
          <Wordmark />
        </Link>
        <nav className="hidden items-center gap-1 sm:flex">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'rounded-full px-3.5 py-1.5 text-sm font-medium transition',
                  active ? 'bg-brand-50 text-brand-800' : 'text-ink-soft hover:text-ink',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <ConnectButton />
      </div>
    </header>
  );
}
