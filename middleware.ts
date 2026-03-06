import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (!pathname.startsWith('/admin')) {
    return NextResponse.next()
  }

  if (pathname === '/admin') {
    return NextResponse.next()
  }

  const admin = req.cookies.get('admin')?.value

  if (admin === '1') {
    return NextResponse.next()
  }

  const url = req.nextUrl.clone()
  url.pathname = '/admin'
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/admin/:path*'],
}
