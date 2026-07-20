'use client';

import dynamic from 'next/dynamic';

const AudioClient = dynamic(() => import('./AudioClient'), { ssr: false });

export default function Page() {
  return <AudioClient />;
}
