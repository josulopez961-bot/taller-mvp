import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const VALID_STATUS = [
  'recibido',
  'diagnostico',
  'en_proceso',
  'pruebas',
  'listo',
  'entregado',
] as const

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const orderId = String(body.orderId || '').trim()
    const status = String(body.status || '').trim()

    if (!orderId) {
      return NextResponse.json({ error: 'orderId es obligatorio' }, { status: 400 })
    }

    if (!VALID_STATUS.includes(status as (typeof VALID_STATUS)[number])) {
      return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })
    }

    const { error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', orderId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json(
      { error: 'Error interno al actualizar estado' },
      { status: 500 }
    )
  }
}
