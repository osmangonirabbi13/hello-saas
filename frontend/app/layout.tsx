import type { Metadata, Viewport } from 'next';
import './globals.css';
import { PwaRegister } from '@/components/offline/pwa-register';

export const metadata: Metadata = {
  title: 'Hello shop ERP',
  description: 'Bangladesh retail operations platform',
  manifest: '/manifest.webmanifest',
};
export const viewport: Viewport = { themeColor: '#047857' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
