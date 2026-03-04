'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type OrderRow = {
  id: string
  public_code: string
  status: string
  summary: string | null
  created_at: string
}

export default function DashboardPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)

  async function updateOrderStatus(orderId: string, status: string) {
    const { error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', orderId)

    if (error) {
      alert(error.message)
    } else {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o))
    }
  }

  useEffect(() => {
    async function boot() {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) {
        router.push('/login')
        return
      }

      const { data, error } = await supabase
        .from('orders')
        .select('id, public_code, status, summary, created_at')
        .order('created_at', { ascending: false })

      if (!error && data) setOrders(data as OrderRow[])
      setLoading(false)
    }

    boot()
  }, [router])

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Panel - Ordenes</h1>
        <div className="flex gap-2">
          <Link className="rounded-md border px-3 py-2" href="/dashboard/orders/new">
            Nueva Orden
          </Link>
          <button className="rounded-md border px-3 py-2" onClick={signOut}>
            Salir
          </button>
        </div>
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-gray-500">Cargando...</p>
      ) : orders.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">Aun no hay ordenes.</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">Codigo</th>
                <th className="text-left p-2">Estado</th>
                <th className="text-left p-2">Resumen</th>
                <th className="text-left p-2">Link Cliente</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b">
                  <td className="p-2 font-mono">{o.public_code}</td>
                  <td className="p-2">
                    <select
                      className="rounded-md border px-2 py-1"
                      value={o.status}
                      onChange={(e) => updateOrderStatus(o.id, e.target.value)}
                    >
                      <option value="recibido">recibido</option>
                      <option value="en_proceso">en_proceso</option>
                      <option value="listo">listo</option>
                      <option value="entregado">entregado</option>
                    </select>
                  </td>
                  <td className="p-2">{o.summary ?? '-'}</td>
                  <td className="p-2">
                    <div className="flex items-center gap-3">
                      <Link
                        className="underline"
                        href={`/o/${o.public_code}`}
                        target="_blank"
                      >
                        Ver
                      </Link>

                      <button
                        className="rounded-lg border px-3 py-1 text-sm hover:bg-white/5"
                        onClick={() => {
                          if (typeof window !== 'undefined') {
                            const url = `${window.location.origin}/o/${o.public_code}`
                            navigator.clipboard.writeText(url)
                            alert('Link copiado ✅')
                          }
                        }}
                      >
                        Copiar link
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
