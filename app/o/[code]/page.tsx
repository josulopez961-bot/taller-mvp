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
  const colorMap: Record<string, string> = {
    recibido: '#6b7280',     // gris
    diagnostico: '#94a3b8',  // gris azulado
    en_proceso: '#f97316',   // naranja
    prueba: '#8b5cf6',       // violeta
    listo: '#3b82f6',        // azul
    entregado: '#22c55e',    // verde
  }
  return colorMap[status] ?? '#6b7280'
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

function formatUpdateTime(dateStr?: string | null) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return null
  return new Intl.DateTimeFormat('es-EC', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export default function PublicOrderPage() {
  const params = useParams()
  const raw = (params as any)?.code
  const code = Array.isArray(raw) ? raw[0] : raw

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
          status_updated_at,
          vehicles (
            plate,
            make,
            model,
            year
          )
        `)
        .eq('public_code', cleanCode)
        .maybeSingle()

      if (error) {
        setErr(error.message)
      } else {
        setOrder(data)
      }
      setLoading(false)
    }

    load()
  }, [code])

  if (loading) return <div className="min-h-screen p-6 text-white bg-black">Cargando...</div>

  if (err) {
    return (
      <div className="min-h-screen p-6 text-white bg-black text-center">
        <h1 className="text-xl font-semibold text-red-500">Error al cargar</h1>
        <p className="mt-2 text-sm text-gray-400">{err}</p>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="min-h-screen p-6 text-white bg-black text-center">
        <h1 className="text-xl font-semibold">Orden no encontrada</h1>
        <p className="mt-2 text-sm text-gray-500">Por favor verifica el código enviado.</p>
      </div>
    )
  }

  const p = percent(order.status)
  const eta = formatDate(order?.estimated_ready_at)
  const lastUpdate = formatUpdateTime(order?.status_updated_at)

  return (
    <div className="min-h-screen p-6 text-white bg-black max-w-2xl mx-auto">
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center">
            <span className="text-lg font-bold">FC</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Taller Finecar</h1>
            <p className="text-xs text-white/40 uppercase tracking-widest">Premium Service Tracking</p>
          </div>
        </div>
      </header>

      <main className="space-y-6">
        {/* Status Card */}
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase">Orden</div>
              <div className="text-xl font-mono font-bold text-white">{order.public_code}</div>
            </div>
            {lastUpdate && (
              <div className="text-right">
                <div className="text-xs font-medium text-gray-500 uppercase">Actualizado</div>
                <div className="text-xs font-medium text-gray-300">{lastUpdate}</div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase mb-1">Estado Actual</div>
                <div className="text-2xl font-bold capitalize" style={{ color: barColor(order.status) }}>
                  {order.status.replace('_', ' ')}
                </div>
              </div>
              <div className="text-3xl font-black opacity-20">{p}%</div>
            </div>

            <div className="h-4 w-full rounded-full bg-gray-900 border border-white/5 overflow-hidden">
              <div
                className="h-full rounded-full shadow-[0_0_20px_rgba(0,0,0,0.5)]"
                style={{
                  width: `${p}%`,
                  background: barColor(order.status),
                  transition: 'all 1s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
              />
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-white/5">
            <div className="text-xs font-medium text-gray-500 uppercase mb-2">Detalles del Proceso</div>
            <div className="text-gray-300 leading-relaxed">
              {order.summary ?? 'El equipo técnico está trabajando en su vehículo. Pronto habrá más detalles.'}
            </div>
          </div>
          
          <div className="mt-8 flex flex-col gap-3">
            <a
              href={`https://wa.me/593995556084?text=Hola%20Josué,%20estoy%20consultando%20por%20mi%20orden%20${order.public_code}`}
              target="_blank"
              className="flex items-center justify-center gap-3 rounded-2xl bg-[#25D366] px-6 py-4 text-white font-bold hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-green-900/20"
            >
              <span className="text-xl">💬</span>
              Contactar Mantenimiento
            </a>
            <a
              href={`https://wa.me/593995318519?text=Hola%20Patricio,%20estoy%20consultando%20por%20mi%20orden%20${order.public_code}`}
              target="_blank"
              className="flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-white font-medium hover:bg-white/10 transition-all text-sm"
            >
              👤 Contactar Gerencia
            </a>
          </div>
        </div>

        {/* Vehicle Info */}
        <div className="rounded-3xl border border-white/10 bg-gray-900/50 p-6">
          <div className="text-xs font-medium text-gray-500 uppercase mb-4">Vehículo en Taller</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
            <div>
              <div className="text-[10px] text-gray-500 uppercase font-bold tracking-tighter">Placa</div>
              <div className="text-lg font-bold text-white uppercase tracking-wider">{order.vehicles?.plate ?? '—'}</div>
            </div>
            <div>
              <div className="text-[10px] text-gray-500 uppercase font-bold tracking-tighter">Modelo</div>
              <div className="text-lg font-bold text-white capitalize">
                {(order.vehicles?.make && order.vehicles?.model)
                  ? `${order.vehicles.make} ${order.vehicles.model}`
                  : '—'}
              </div>
            </div>
            <div className="hidden sm:block">
              <div className="text-[10px] text-gray-500 uppercase font-bold tracking-tighter">Año</div>
              <div className="text-lg font-bold text-white">{order.vehicles?.year ?? '—'}</div>
            </div>
          </div>
        </div>

        {/* ETA Card */}
        <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-orange-500/10 to-transparent p-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-orange-500 text-xl">🕒</span>
            <div className="text-xs font-medium text-gray-500 uppercase">Entrega Estimada</div>
          </div>
          {eta ? (
            <div className="text-2xl font-black capitalize text-orange-500 drop-shadow-sm">{eta}</div>
          ) : (
            <div className="text-lg font-medium text-gray-400">Nuestro equipo confirmará la entrega pronto.</div>
          )}
        </div>
      </main>

      <footer className="mt-12 text-center text-[10px] text-white/20 uppercase tracking-[0.2em] pb-8">
        © {new Date().getFullYear()} Taller Finecar • Servicio de Excelencia
      </footer>
    </div>
  )
}
