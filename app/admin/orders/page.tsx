import { createClient } from '@supabase/supabase-js'
import OrdersTable from './orders-table'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'

export default async function AdminOrdersPage() {
  const { data: orders, error } = await supabase
    .from('orders')
    .select(`
      id,
      public_code,
      status,
      summary,
      created_at,
      vehicles (
        plate,
        make,
        model,
        customers (
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
        summary: order.summary,
        created_at: order.created_at,
        plate: vehicle?.plate || '',
        make: vehicle?.make || '',
        model: vehicle?.model || '',
        customer_name: customer?.full_name || '',
        whatsapp: customer?.whatsapp || '',
      }
    }) || []

  return <OrdersTable initialOrders={normalizedOrders} />
}
