'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

export default function NewOrderPage() {
  const router = useRouter()
  const [summary, setSummary] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function createOrder() {
    setLoading(true)
    setError(null)

    const vehicleId = 'c308f1c3-7963-4f83-9f0f-f56372adad4c'
    const publicCode = genCode()

    const { error } = await supabase.from('orders').insert({
      vehicle_id: vehicleId,
      public_code: publicCode,
      status: 'recibido',
      summary: summary || null,
    })

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen p-6">
      <h1 className="text-xl font-semibold">Nueva Orden</h1>

      <div className="mt-6 max-w-lg space-y-3">
        <div>
          <label className="text-sm">Resumen</label>
          <input
            className="mt-1 w-full rounded-md border p-2"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Ej: Cambio de aceite y revision"
          />
        </div>

        {error && <div className="text-sm text-red-600">{error}</div>}

        <button
          className="rounded-md border px-3 py-2"
          onClick={createOrder}
          disabled={loading}
        >
          {loading ? 'Creando...' : 'Crear orden'}
        </button>
      </div>
    </div>
  )
}