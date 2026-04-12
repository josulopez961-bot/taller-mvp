import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getOrderSummary, normalizeOrderWorkType } from '@/lib/order-work-types'

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
    const engine = String(body.engine || '').trim()
    const intakeReason = String(body.intake_reason || body.summary || '').trim()
    const summary = getOrderSummary(body.work_type, intakeReason)
    const year = body.year ? Number(body.year) : null
    const intakeKm = body.intake_km ? Number(body.intake_km) : null
    const normalizedWorkType = normalizeOrderWorkType(body.work_type)

    if (!plate) {
      return NextResponse.json({ error: 'La placa es obligatoria' }, { status: 400 })
    }

    if (!customerName) {
      return NextResponse.json({ error: 'El nombre del cliente es obligatorio' }, { status: 400 })
    }

    if (!whatsapp) {
      return NextResponse.json({ error: 'El WhatsApp es obligatorio' }, { status: 400 })
    }

    if (!make || !model) {
      return NextResponse.json({ error: 'Marca y modelo son obligatorios' }, { status: 400 })
    }

    if (!intakeReason) {
      return NextResponse.json({ error: 'El motivo de visita es obligatorio' }, { status: 400 })
    }

    const { data: existingVehicle } = await supabase
      .from('vehicles')
      .select('id, customer_id')
      .eq('plate', plate)
      .maybeSingle()

    let vehicleId = existingVehicle?.id ?? null
    let customerId = existingVehicle?.customer_id ?? null

    if (!vehicleId) {
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
          make,
          model,
          year: year || null,
          engine: engine || null,
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
    } else {
      const { error: updateVehicleError } = await supabase
        .from('vehicles')
        .update({
          make,
          model,
          year: year || null,
          engine: engine || null,
        })
        .eq('id', vehicleId)

      if (updateVehicleError) {
        return NextResponse.json(
          { error: updateVehicleError.message || 'No se pudo actualizar el vehiculo' },
          { status: 500 }
        )
      }
    }

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

    const { error: insertError } = await supabase
      .from('orders')
      .insert({
        vehicle_id: vehicleId,
        public_code: code,
        status: 'recibido',
        summary,
        work_type: normalizedWorkType,
        intake_reason: intakeReason,
        customer_concern: String(body.customer_concern || intakeReason || '').trim() || null,
        paint_scope: String(body.paint_scope || '').trim() || null,
        insurance_scope: String(body.insurance_scope || '').trim() || null,
        insurance_company: String(body.insurance_company || '').trim() || null,
        insurance_claim_number: String(body.insurance_claim_number || '').trim() || null,
        current_km: intakeKm,
      })

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ code })
  } catch {
    return NextResponse.json({ error: 'Error interno al crear la orden' }, { status: 500 })
  }
}
