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

const STATUS_INDEX: Record<(typeof VALID_STATUS)[number], number> = {
  recibido: 0,
  diagnostico: 1,
  en_proceso: 2,
  pruebas: 3,
  listo: 4,
  entregado: 5,
}

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

    const now = new Date().toISOString()
    const normalizedStatus = status as (typeof VALID_STATUS)[number]
    const statusIndex = STATUS_INDEX[normalizedStatus]

    const stageTimestamps: Record<string, string | null> = {
      diagnosis_started_at: statusIndex >= 1 ? now : null,
      work_started_at: statusIndex >= 2 ? now : null,
      testing_started_at: statusIndex >= 3 ? now : null,
      ready_at: statusIndex >= 4 ? now : null,
      delivered_at: statusIndex >= 5 ? now : null,
    }

    const { data: existingOrder, error: existingOrderError } = await supabase
      .from('orders')
      .select(
        'id, diagnosis_started_at, work_started_at, testing_started_at, ready_at, delivered_at'
      )
      .eq('id', orderId)
      .maybeSingle()

    if (existingOrderError) {
      return NextResponse.json({ error: existingOrderError.message }, { status: 500 })
    }

    if (!existingOrder) {
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
    }

    const payload = {
      status: normalizedStatus,
      diagnosis_started_at:
        statusIndex >= 1 ? existingOrder.diagnosis_started_at || stageTimestamps.diagnosis_started_at : null,
      work_started_at:
        statusIndex >= 2 ? existingOrder.work_started_at || stageTimestamps.work_started_at : null,
      testing_started_at:
        statusIndex >= 3 ? existingOrder.testing_started_at || stageTimestamps.testing_started_at : null,
      ready_at:
        statusIndex >= 4 ? existingOrder.ready_at || stageTimestamps.ready_at : null,
      delivered_at:
        statusIndex >= 5 ? existingOrder.delivered_at || stageTimestamps.delivered_at : null,
    }

    const { error } = await supabase
      .from('orders')
      .update(payload)
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
