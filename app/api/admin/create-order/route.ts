import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST() {
  try {
    const { data: last, error: lastError } = await supabase
      .from('orders')
      .select('public_code')
      .order('created_at', { ascending: false })
      .limit(1)

    if (lastError) {
      return NextResponse.json({ error: lastError.message }, { status: 500 })
    }

    let next = 1

    if (last && last[0]?.public_code?.startsWith('FIN')) {
      next = parseInt(last[0].public_code.replace('FIN', '')) + 1
    }

    const code = `FIN${String(next).padStart(3, '0')}`

    // usamos por ahora el primer vehículo disponible
    const { data: vehicle, error: vehicleError } = await supabase
      .from('vehicles')
      .select('id')
      .limit(1)
      .single()

    if (vehicleError || !vehicle) {
      return NextResponse.json(
        { error: 'No existe ningún vehículo para asociar a la orden' },
        { status: 500 }
      )
    }

    const { error: insertError } = await supabase
      .from('orders')
      .insert({
        public_code: code,
        status: 'recibido',
        summary: 'Nueva orden',
        vehicle_id: vehicle.id,
      })

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ code })
  } catch (err) {
    return NextResponse.json(
      { error: 'Error interno al crear la orden' },
      { status: 500 }
    )
  }
}
