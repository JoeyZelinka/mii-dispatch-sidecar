import { NextResponse } from 'next/server';
import { getCookieName } from '@/lib/demoAuth';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  // Expire the access cookie immediately.
  response.cookies.set({
    name: getCookieName(),
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  return response;
}
