import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { pass } = await req.json()
    const adminPass = process.env.ADMIN_PASS

    if (!adminPass || pass !== adminPass) {
      return NextResponse.json({ ok: false }, { status: 401 })
    }

    const res = NextResponse.json({ ok: true })
    res.cookies.set('admin', '1', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: true,
      maxAge: 60 * 60 * 12,
    })

    return res
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
