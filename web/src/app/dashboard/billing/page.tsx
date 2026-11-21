'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function BillingRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/calls');
  }, [router]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center text-slate-400 text-sm">
      <span>Redirecting to calls dashboard...</span>
    </div>
  );
}
