import type { Metadata } from 'next';
import DemoLoginClient from './DemoLoginClient';

export const metadata: Metadata = {
  title: 'MII_lite Guided Demo — Access',
  robots: { index: false, follow: false },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const sp = await searchParams;
  const next = typeof sp.next === 'string' && sp.next.startsWith('/') ? sp.next : '/demo';
  return <DemoLoginClient next={next} />;
}
