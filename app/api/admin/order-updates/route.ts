import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  try {
    const orderId = req.nextUrl.searchParams.get('orderId')?.trim()

    if (!orderId) {
      return NextResponse.json({ error: 'orderId es obligatorio' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('order_updates')
      .select('id, message, created_at')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ updates: data || [] })
  } catch {
    return NextResponse.json({ error: 'Error interno al obtener notas' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const orderId = String(body.orderId || '').trim()
    const message = String(body.message || '').trim()

    if (!orderId) {
      return NextResponse.json({ error: 'orderId es obligatorio' }, { status: 400 })
    }

    if (!message) {
      return NextResponse.json({ error: 'La nota no puede estar vacía' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('order_updates')
      .insert({
        order_id: orderId,
        message,
      })
      .select('id, message, created_at')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ update: data })
  } catch {
    return NextResponse.json({ error: 'Error interno al guardar nota' }, { status: 500 })
  }
}
