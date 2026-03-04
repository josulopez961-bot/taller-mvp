'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function percent(status: string) {
  const progressMap: Record<string, number> = {
    recibido: 10,
    diagnostico: 25,
    en_proceso: 50,
    prueba: 75,
    listo: 90,
    entregado: 100
  }
  return progressMap[status] ?? 0
}

function barColor(status: string) {
  if (status === 'recibido') return '#6b7280'     // gris
  if (status === 'en_proceso') return '#f97316'   // naranja
  if (status === 'listo') return '#3b82f6'        // azul
  if (status === 'entregado') return '#22c55e'    // verde
  return '#6b7280'
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return null
  return new Intl.DateTimeFormat('es-EC', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  }).format(d)
}

export default function PublicOrderPage() {
  const params = useParams()
  const raw = (params as any)?.code
  const code = Array.isArray(raw) ? raw[0] : raw

  console.log('CODE RECIBIDO:', code)

  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [order, setOrder] = useState<any>(null)

  useEffect(() => {
    async function load() {
      if (!code) return

      const cleanCode = (code || '').trim()

      const { data, error } = await supabase
        .from('orders')
        .select(`
          public_code,
          status,
          summary,
          estimated_ready_at,
          vehicles (
            plate,
            make,
            model,
            year
          )
        `)
        .eq('public_code', cleanCode)
        .maybeSingle()

      console.log('BUSCANDO public_code =', cleanCode)
      console.log('ERROR =', error)
      console.log('DATA =', data)

      if (error) setErr(error.message)
      else setOrder(data)

      setLoading(false)
    }

    load()
  }, [code])

  if (loading) return <div className="min-h-screen p-6 text-white bg-black">Cargando...</div>

  if (err) {
    return (
      <div className="min-h-screen p-6 text-white bg-black">
        <h1 className="text-xl font-semibold">No se pudo cargar</h1>
        <p className="mt-2 text-sm text-red-600">{err}</p>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="min-h-screen p-6 text-white bg-black">
        <h1 className="text-xl font-semibold">Orden no encontrada</h1>
      </div>
    )
  }

  const p = percent(order.status)
  const eta = formatDate(order?.estimated_ready_at)

  return (
    <div className="min-h-screen p-6 text-white bg-black">
      <header className="mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center">
            <span className="text-sm font-semibold">FC</span>
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Taller Finecar</h1>
            <p className="text-sm text-white/60">Seguimiento de vehículo premium</p>
          </div>
        </div>
      </header>

      <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm text-gray-400">Código de Orden</div>
        <div className="font-mono text-lg">{order.public_code}</div>

        <div className="mt-4">
          <div className="text-sm text-gray-400">Estado</div>
          <div className="font-medium capitalize">{order.status}</div>

          <div className="mt-2 h-3 w-full rounded-full bg-gray-800">
            <div
              className="h-3 rounded-full"
              style={{
                width: `${p}%`,
                background: barColor(order.status),
                transition: 'all 500ms ease-out',
              }}
            />
          </div>
          <div className="mt-1 text-sm text-gray-500">{p}% completado</div>
        </div>

        <div className="mt-4">
          <div className="text-sm text-gray-400">Detalle de Trabajo</div>
          <div className="text-gray-200 mt-1">{order.summary ?? 'Sin detalles adicionales'}</div>
        </div>

        <div className="mt-8 space-y-3">
          <div className="text-sm font-medium text-gray-400">Contactar al taller</div>
          
          <div className="flex flex-col gap-2">
            <a
              href={`https://wa.me/593995556084?text=Hola%20Josué,%20estoy%20consultando%20por%20mi%20orden%20${order.public_code}`}
              target="_blank"
              className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-white font-medium hover:bg-green-500 transition w-fit"
            >
              💬 Josué López (Mantenimiento)
            </a>

            <a
              href={`https://wa.me/593995318519?text=Hola%20Patricio,%20estoy%20consultando%20por%20mi%20orden%20${order.public_code}`}
              target="_blank"
              className="inline-flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white font-medium hover:bg-white/10 transition w-fit text-sm"
            >
              👤 Patricio López (Gerente General)
            </a>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-white/10 bg-gray-900 p-6">
        <div className="text-sm text-gray-400 mb-4">Información del Vehículo</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div>
            <div className="text-sm text-gray-400">Placa</div>
            <div className="text-lg font-semibold">{order.vehicles?.plate ?? '—'}</div>
          </div>
          <div>
            <div className="text-sm text-gray-400">Modelo</div>
            <div className="text-lg font-semibold">
              {(order.vehicles?.make && order.vehicles?.model)
                ? `${order.vehicles.make} ${order.vehicles.model}`
                : '—'}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-400">Año</div>
            <div className="text-lg font-semibold">{order.vehicles?.year ?? '—'}</div>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-gray-900 p-6">
        <div className="text-sm text-gray-400">Entrega Estimada</div>
        {eta ? (
          <div className="mt-2 text-xl font-bold capitalize text-orange-400">{eta}</div>
        ) : (
          <div className="mt-2 text-gray-400">Por confirmar con el asesor</div>
        )}
      </div>
    </div>
  )
}
