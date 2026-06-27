import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import type { ReactNode } from 'react';
import { Toaster } from 'sonner';
import { WalletProvider } from '@/ui/wallet/WalletProvider';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const grotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-grotesk',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3003'),
  title: {
    default: 'Sahod — one paycheck, split to everyone who counts on it',
    template: '%s · Sahod',
  },
  description:
    'Sahod fans a single incoming salary out to every person who depends on it — family, savings, a co-worker — in one real on-chain Stellar transaction. Set the shares once, pay everyone at once.',
  icons: { icon: '/icon.svg' },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${grotesk.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        <WalletProvider>
          {children}
          <Toaster richColors position="top-center" />
        </WalletProvider>
      </body>
    </html>
  );
}
