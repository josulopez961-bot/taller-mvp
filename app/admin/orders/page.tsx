import { createClient } from '@supabase/supabase-js'
import OrdersTable from './orders-table'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AdminOrdersPage() {
  const { data: orders, error } = await supabase
    .from('orders')
    .select(`
      id,
      public_code,
      status,
      work_type,
      summary,
      created_at,
      estimated_delivery_date,
      intake_reason,
      customer_concern,
      diagnosis_detail,
      repair_detail,
      repair_cost,
      paint_scope,
      insurance_scope,
      insurance_company,
      insurance_claim_number,
      approval_status,
      authorized_priorities,
      proforma_sent_at,
      approved_at,
      rejected_at,
      approval_decided_at,
      vehicle_id,
      current_km,
      generate_maintenance_plan,
      service_interval_km,
      vehicles (
        plate,
        make,
        model,
        customers (
          id,
          full_name,
          whatsapp
        )
      )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white p-8">
        <h1 className="text-3xl font-bold mb-4">Órdenes</h1>
        <p className="text-red-400">Error: {error.message}</p>
      </div>
    )
  }

  const normalizedOrders =
    orders?.map((order) => {
      const vehicle = Array.isArray(order.vehicles) ? order.vehicles[0] : order.vehicles
      const customer = Array.isArray(vehicle?.customers)
        ? vehicle.customers[0]
        : vehicle?.customers

      return {
        id: order.id,
        public_code: order.public_code,
        status: order.status,
        work_type: order.work_type,
        summary: order.summary,
        created_at: order.created_at,
        estimated_delivery_date: order.estimated_delivery_date,
        intake_reason: order.intake_reason,
        customer_concern: order.customer_concern,
        diagnosis_detail: order.diagnosis_detail,
        repair_detail: order.repair_detail,
        repair_cost: order.repair_cost,
        paint_scope: order.paint_scope,
        insurance_scope: order.insurance_scope,
        insurance_company: order.insurance_company,
        insurance_claim_number: order.insurance_claim_number,
        approval_status: order.approval_status,
        authorized_priorities: order.authorized_priorities,
        proforma_sent_at: order.proforma_sent_at,
        approved_at: order.approved_at,
        rejected_at: order.rejected_at,
        approval_decided_at: order.approval_decided_at,
        plate: vehicle?.plate || '',
        make: vehicle?.make || '',
        model: vehicle?.model || '',
        customer_id: customer?.id || null,
        customer_name: customer?.full_name || '',
        whatsapp: customer?.whatsapp || '',
        vehicle_id: order.vehicle_id,
        current_km: order.current_km,
        generate_maintenance_plan: order.generate_maintenance_plan,
        service_interval_km: order.service_interval_km,
      }
    }) || []

  return <OrdersTable initialOrders={normalizedOrders} />
}

