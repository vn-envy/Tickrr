import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Tickrr — Betting intelligence',
  description:
    'Compare prediction markets with fresh quotes, transparent evidence, and grounded analysis.',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
