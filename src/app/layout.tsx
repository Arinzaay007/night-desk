import type { Metadata } from 'next';
import { Inter, Space_Grotesk, JetBrains_Mono, Instrument_Serif } from 'next/font/google';
import './globals.css';
import { Header } from '@/components/design/Header';
import { Footer } from '@/components/design/Footer';
import { DryRunBanner } from '@/components/DryRunBanner';
import { WalletProvider } from '@/components/WalletProvider';

/**
 * The four faces the design is built on, self-hosted through next/font.
 *
 * The design loaded these from the Google Fonts CDN with a <link>. Self-hosting
 * removes a third-party request, kills the flash of unstyled text, and — the
 * reason it matters here — makes the type render identically in a sandboxed
 * preview with no network, which is where this app first gets looked at.
 */
const sans = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const display = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

const serif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-instrument-serif',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Night Desk — Trade plans you can actually run',
  description:
    'Publish a trade plan as a link. Anyone who opens it executes it at their own size, with their own take-profit and stop-loss, on Base.',
  openGraph: {
    title: 'Night Desk — Trade plans you can actually run',
    description:
      'Publish a tokenized-equity trade plan as a link. Mirrors execute at their own size with their own independent stop-loss.',
    type: 'website',
  },
  themeColor: '#04060c',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${display.variable} ${mono.variable} ${serif.variable}`}
    >
      <body className="grain relative">
        {/* The wallet is app-wide, so the header and the page agree about it. */}
        <WalletProvider>
          <Header />
          <DryRunBanner />
          <main>{children}</main>
          <Footer />
        </WalletProvider>
      </body>
    </html>
  );
}
