import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'StaffCaller — Automatic Call Tracking & Sales CRM Platform',
  description: 'Production SaaS CRM for automatic phone call recording and lead synchronization.',
  icons: {
    icon: '/icon.png',
    apple: '/logo.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-slate-50 text-slate-900">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
