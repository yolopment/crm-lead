'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function IntegrationsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/admin');
  }, [router]);

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-sm font-medium text-slate-500">Redirecting to Dashboard...</div>
    </div>
  );
}
