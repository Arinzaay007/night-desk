import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Night Desk — trade plans you can click',
  description:
    'Publish a tokenized-equity trade plan as a link. Anyone who opens it executes it in one tap — at their own size, with their own independent stop-loss, on Base.',
  openGraph: {
    title: 'Night Desk',
    description:
      'Publish a tokenized-equity trade plan as a link. Mirrors execute at their own size with their own take-profit and stop-loss.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
