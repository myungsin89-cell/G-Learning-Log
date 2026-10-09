import { NextResponse } from 'next/server';

export function proxy(request) {
  if (process.env.NEXT_PUBLIC_APP_MODE === 'readonly') {
    return NextResponse.redirect(new URL('/next-version', request.url));
  }
  if (process.env.NEXT_PUBLIC_APP_ENTRY === 'next') {
    if (request.nextUrl.pathname === '/') return NextResponse.rewrite(new URL('/next-version', request.url));
    if (request.nextUrl.pathname.startsWith('/class/') || request.nextUrl.pathname.startsWith('/dashboard/') || request.nextUrl.pathname.startsWith('/student/')) return NextResponse.redirect(new URL('/next-version', request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ['/', '/class/:path*', '/dashboard/:path*', '/student/:path*'] };
