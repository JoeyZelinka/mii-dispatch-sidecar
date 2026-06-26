import { NextResponse } from 'next/server';
import {
  getAccessCode,
  getCookieName,
  getSessionToken,
  isAuthEnabled,
  SESSION_MAX_AGE,
} from '@/lib/demoAuth';

export async function POST(request: Request) {
  // Auth disabled → nothing to gate.
  if (!isAuthEnabled()) {
    return NextResponse.json({ ok: true });
  }

  let accessCode = '';
  try {
    const body = (await request.json()) as { accessCode?: unknown };
    if (typeof body?.accessCode === 'string') accessCode = body.accessCode;
  } catch {
    // ignore malformed body — treated as an invalid attempt
  }

  // Never log the submitted code.
  if (accessCode !== getAccessCode()) {
    return NextResponse.json({ ok: false, error: 'Invalid access code.' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: getCookieName(),
    value: getSessionToken(),
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}
