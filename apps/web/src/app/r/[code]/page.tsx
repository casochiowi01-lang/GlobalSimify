'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { writeReferralCode } from '@/lib/referral';

export default function ReferralPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();

  useEffect(() => {
    const code = (params.code ?? '').toLowerCase();
    if (code) writeReferralCode(code);
    router.replace('/');
  }, [params, router]);

  return (
    <main className="flex flex-1 items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
    </main>
  );
}
