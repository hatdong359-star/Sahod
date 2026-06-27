'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { requestPublicKey, sign, WalletError } from './stellarClient';

type Status = 'loading' | 'disconnected' | 'connecting' | 'connected';

type WalletState = {
  status: Status;
  publicKey: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
};

const WalletCtx = createContext<WalletState | null>(null);

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

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [publicKey, setPublicKey] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await api('/api/auth/me');
        if (active) {
          setPublicKey(data.publicKey);
          setStatus('connected');
        }
      } catch {
        if (active) setStatus('disconnected');
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const connect = useCallback(async () => {
    setStatus('connecting');
    try {
      const pubkey = await requestPublicKey();
      const challenge = await api('/api/auth/challenge', { publicKey: pubkey });
      const signedXdr = await sign(challenge.txXdr, pubkey);
      await api('/api/auth/verify', { publicKey: pubkey, signedNonce: signedXdr });
      setPublicKey(pubkey);
      setStatus('connected');
      toast.success('Wallet connected', { description: 'You can now run your splits.' });
    } catch (e) {
      setStatus('disconnected');
      const msg = e instanceof WalletError || e instanceof Error ? e.message : 'Could not connect.';
      toast.error('Connection failed', { description: msg });
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await api('/api/auth/logout', {});
    } catch {
      /* ignore */
    }
    setPublicKey(null);
    setStatus('disconnected');
    toast('Wallet disconnected');
  }, []);

  const value = useMemo<WalletState>(
    () => ({ status, publicKey, connect, disconnect }),
    [status, publicKey, connect, disconnect],
  );

  return <WalletCtx.Provider value={value}>{children}</WalletCtx.Provider>;
}

export function useWallet(): WalletState {
  const ctx = useContext(WalletCtx);
  if (!ctx) throw new Error('useWallet must be used within WalletProvider');
  return ctx;
}
