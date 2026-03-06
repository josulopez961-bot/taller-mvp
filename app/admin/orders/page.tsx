import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function AdminOrdersPage() {

  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-black text-white p-10">
      <a
        href="/admin/new"
        className="bg-green-600 px-4 py-2 rounded-lg mb-6 inline-block"
      >
        Nueva Orden
      </a>
      
      <h1 className="text-3xl font-bold mb-6">Panel de Órdenes</h1>

      <div className="space-y-4">
        {orders?.map((order:any) => (
          <div
            key={order.id}
            className="border border-white/20 rounded-lg p-4 bg-white/5"
          >
            <div className="flex justify-between">
              <div>
                <p className="text-lg font-semibold">{order.public_code}</p>
                <p className="text-sm text-white/60">{order.status}</p>
              </div>

              <a
                href={`/o/${order.public_code}`}
                target="_blank"
                className="bg-blue-600 px-4 py-2 rounded"
              >
                Ver cliente
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
