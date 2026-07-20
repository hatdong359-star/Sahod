'use client';

import { Loader2, LogOut, Wallet } from 'lucide-react';
import { useState } from 'react';
import { shortKey } from '@/ui/lib/format';
import { useWallet } from '@/ui/wallet/WalletProvider';

export function ConnectButton() {
  const { status, publicKey, connect, disconnect } = useWallet();
  const [open, setOpen] = useState(false);

  if (status === 'connected' && publicKey) {
    return (
      <div className="relative">
        <button
          type="button"
          data-testid="wallet-pill"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3.5 py-2 text-sm font-medium text-ink shadow-sm transition hover:border-brand-100"
        >
          <span className="h-2 w-2 rounded-full bg-positive" />
          <span className="tnum">{shortKey(publicKey)}</span>
        </button>
        {open && (
          <>
            <button
              type="button"
              aria-label="Close menu"
              className="fixed inset-0 z-10 cursor-default"
              onClick={() => setOpen(false)}
            />
            <div className="absolute right-0 z-20 mt-2 w-44 rounded-xl border border-line bg-white p-1.5 shadow-lg">
              <button
                type="button"
                data-testid="disconnect-button"
                onClick={() => {
                  setOpen(false);
                  void disconnect();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-soft transition hover:bg-mist"
              >
                <LogOut className="h-4 w-4" />
                Disconnect
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  const connecting = status === 'connecting';
  return (
    <button
      type="button"
      data-testid="connect-button"
      disabled={connecting || status === 'loading'}
      onClick={() => void connect()}
      className="btn-primary inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60"
    >
      {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
      {connecting ? 'Connecting…' : 'Connect wallet'}
    </button>
  );
}
