import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const plate = String(body.plate || '').trim().toUpperCase()
    const customerName = String(body.customer_name || '').trim()
    const whatsapp = String(body.whatsapp || '').trim()
    const make = String(body.make || '').trim()
    const model = String(body.model || '').trim()
    const summary = String(body.summary || '').trim()
    const year = body.year ? Number(body.year) : null

    if (!plate) {
      return NextResponse.json({ error: 'La placa es obligatoria' }, { status: 400 })
    }

    if (!summary) {
      return NextResponse.json({ error: 'El servicio es obligatorio' }, { status: 400 })
    }

    // 1) Buscar vehículo por placa
    const { data: existingVehicle } = await supabase
      .from('vehicles')
      .select('id, customer_id')
      .eq('plate', plate)
      .maybeSingle()

    let vehicleId = existingVehicle?.id ?? null
    let customerId = existingVehicle?.customer_id ?? null

    // 2) Si no existe vehículo, crear cliente y vehículo
    if (!vehicleId) {
      if (!customerName) {
        return NextResponse.json(
          { error: 'Si la placa no existe, debes ingresar nombre del cliente' },
          { status: 400 }
        )
      }

      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .insert({
          full_name: customerName,
          whatsapp: whatsapp || null,
        })
        .select('id')
        .single()

      if (customerError || !customer) {
        return NextResponse.json(
          { error: customerError?.message || 'No se pudo crear el cliente' },
          { status: 500 }
        )
      }

      customerId = customer.id

      const { data: vehicle, error: vehicleError } = await supabase
        .from('vehicles')
        .insert({
          customer_id: customerId,
          plate,
          make: make || null,
          model: model || null,
          year: year || null,
        })
        .select('id')
        .single()

      if (vehicleError || !vehicle) {
        return NextResponse.json(
          { error: vehicleError?.message || 'No se pudo crear el vehículo' },
          { status: 500 }
        )
      }

      vehicleId = vehicle.id
    }

    // 3) Generar siguiente FIN###
    const { data: allCodes, error: codesError } = await supabase
      .from('orders')
      .select('public_code')
      .ilike('public_code', 'FIN%')

    if (codesError) {
      return NextResponse.json({ error: codesError.message }, { status: 500 })
    }

    let maxNum = 0
    for (const row of allCodes || []) {
      const raw = String(row.public_code || '').replace('FIN', '')
      const n = parseInt(raw, 10)
      if (!Number.isNaN(n) && n > maxNum) maxNum = n
    }

    const code = `FIN${String(maxNum + 1).padStart(3, '0')}`

    // 4) Crear orden
    const { error: insertError } = await supabase
      .from('orders')
      .insert({
        vehicle_id: vehicleId,
        public_code: code,
        status: 'recibido',
        summary,
      })

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ code })
  } catch {
    return NextResponse.json({ error: 'Error interno al crear la orden' }, { status: 500 })
  }
}
