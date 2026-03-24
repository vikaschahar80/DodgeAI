import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Graph O2C Explorer',
  description: 'AI-Powered SAP O2C Context Graph Explorer',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
