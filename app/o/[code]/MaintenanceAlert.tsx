'use client'

import { useState } from 'react'

type PlanItem = {
  category: 'labor' | 'part' | 'supply'
  description: string
  qty: number
  unit_price: number
}

type MaintenancePlan = {
  id: string
  service_name: string
  last_service_km: number
  next_service_km: number
  visible_from_km: number
  status: string
  items: PlanItem[]
}

const WARNING_THRESHOLD_KM = 500

function getAlertLevel(currentKm: number, plan: MaintenancePlan): 'ok' | 'warning' | 'urgent' {
  if (currentKm >= plan.next_service_km) return 'urgent'
  if (currentKm >= plan.next_service_km - WARNING_THRESHOLD_KM) return 'warning'
  return 'ok'
}

function getProgressPercent(currentKm: number, plan: MaintenancePlan): number {
  const range = plan.next_service_km - plan.last_service_km
  if (range <= 0) return 100
  const traveled = currentKm - plan.last_service_km
  return Math.min(Math.max((traveled / range) * 100, 0), 100)
}

export default function MaintenanceAlert({
  plans,
  plate,
  workshopWhatsapp,
}: {
  plans: MaintenancePlan[]
  plate: string
  workshopWhatsapp: string
}) {
  const [kmInput, setKmInput] = useState('')

  const activePlans = plans.filter((p) => p.status === 'scheduled')
  if (activePlans.length === 0) return null

  const currentKm = kmInput !== '' ? parseInt(kmInput) : null

  // El plan más próximo (menor next_service_km)
  const plan = activePlans.sort((a, b) => a.next_service_km - b.next_service_km)[0]

  const alertLevel = currentKm !== null ? getAlertLevel(currentKm, plan) : null
  const progressPercent = currentKm !== null ? getProgressPercent(currentKm, plan) : 0

  const laborItems = plan.items.filter((i) => i.category === 'labor')
  const partItems = plan.items.filter((i) => i.category === 'part')
  const supplyItems = plan.items.filter((i) => i.category === 'supply')
  const totalCost = plan.items.reduce((acc, i) => acc + i.qty * i.unit_price, 0)

  const kmRestantes =
    currentKm !== null ? Math.max(plan.next_service_km - currentKm, 0) : null

  function handleWhatsApp() {
    const phone = workshopWhatsapp.replace(/\D/g, '')
    const msg =
      currentKm !== null
        ? `Hola, soy dueño del vehículo con placa ${plate}. Me acerco a mi próximo mantenimiento (${plan.service_name}) programado para los ${plan.next_service_km.toLocaleString()} km. Actualmente tengo ${currentKm.toLocaleString()} km. ¿Podemos agendar una cita?`
        : `Hola, soy dueño del vehículo con placa ${plate}. Quisiera agendar mi próximo mantenimiento: ${plan.service_name}.`
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const alertStyles = {
    ok: {
      border: 'border-green-700',
      bg: 'bg-green-900/20',
      bar: 'bg-green-500',
      badge: 'bg-green-900/40 border-green-700 text-green-300',
      badgeText: 'Al día',
      icon: '✓',
      title: 'text-green-400',
    },
    warning: {
      border: 'border-orange-600',
      bg: 'bg-orange-900/20',
      bar: 'bg-orange-500',
      badge: 'bg-orange-900/40 border-orange-600 text-orange-300',
      badgeText: 'Próximo',
      icon: '⚠',
      title: 'text-orange-400',
    },
    urgent: {
      border: 'border-red-600',
      bg: 'bg-red-900/20',
      bar: 'bg-red-500',
      badge: 'bg-red-900/40 border-red-600 text-red-300',
      badgeText: 'Vencido',
      icon: '!',
      title: 'text-red-400',
    },
  }

  const style = alertLevel ? alertStyles[alertLevel] : null

  return (
    <section
      className={`rounded-2xl border p-6 transition-colors ${
        style
          ? `${style.border} ${style.bg}`
          : 'border-slate-800 bg-slate-900'
      }`}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-bold">
            Próximo mantenimiento
          </h2>
          <p className="mt-1 text-sm text-slate-400">{plan.service_name}</p>
        </div>
        {alertLevel && style && (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold ${style.badge}`}
          >
            <span>{style.icon}</span>
            {style.badgeText}
          </span>
        )}
      </div>

      {/* Input KM actual */}
      <div className="mt-5">
        <label className="mb-2 block text-sm font-medium text-slate-300">
          Ingresa tu kilometraje actual para ver qué tan cerca estás
        </label>
        <input
          type="number"
          placeholder="Ej: 85000"
          value={kmInput}
          onChange={(e) => setKmInput(e.target.value)}
          className="w-full max-w-xs rounded-xl border border-slate-700 bg-slate-800 p-3 text-white outline-none focus:border-orange-500"
        />
      </div>

      {/* Barra de progreso */}
      <div className="mt-5">
        <div className="mb-2 flex justify-between text-xs text-slate-400">
          <span>{plan.last_service_km.toLocaleString()} km</span>
          <span className="font-semibold text-white">
            Meta: {plan.next_service_km.toLocaleString()} km
          </span>
        </div>
        <div className="h-4 w-full overflow-hidden rounded-full bg-slate-700">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              style ? style.bar : 'bg-slate-500'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        {currentKm !== null && (
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-slate-400">
              KM actual:{' '}
              <span className="font-semibold text-white">
                {currentKm.toLocaleString()} km
              </span>
            </span>
            {kmRestantes !== null && kmRestantes > 0 ? (
              <span className={`font-semibold ${style?.title}`}>
                Faltan {kmRestantes.toLocaleString()} km
              </span>
            ) : (
              <span className="font-semibold text-red-400">
                ¡Mantenimiento vencido!
              </span>
            )}
          </div>
        )}
      </div>

      {/* Alerta contextual */}
      {alertLevel === 'urgent' && (
        <div className="mt-4 rounded-xl border border-red-600 bg-red-900/30 p-4 text-sm text-red-300">
          Tu vehículo ya superó el kilometraje de mantenimiento ({plan.next_service_km.toLocaleString()} km).
          Te recomendamos agendar una cita lo antes posible.
        </div>
      )}
      {alertLevel === 'warning' && kmRestantes !== null && (
        <div className="mt-4 rounded-xl border border-orange-600 bg-orange-900/30 p-4 text-sm text-orange-300">
          Te faltan solo {kmRestantes.toLocaleString()} km para tu próximo mantenimiento.
          Es buen momento para agendar tu cita.
        </div>
      )}
      {alertLevel === 'ok' && (
        <div className="mt-4 rounded-xl border border-green-700 bg-green-900/30 p-4 text-sm text-green-300">
          Tu vehículo está al día. El próximo mantenimiento es a los {plan.next_service_km.toLocaleString()} km.
        </div>
      )}

      {/* Desglose del próximo mantenimiento — solo si está cerca o vencido */}
      {plan.items.length > 0 && alertLevel !== null && alertLevel !== 'ok' && (
        <div className="mt-5 border-t border-slate-700 pt-5">
          <h3 className="mb-3 text-sm font-semibold text-white">
            Qué incluye este mantenimiento
          </h3>

          {laborItems.length > 0 && (
            <div className="mb-3">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-orange-400">
                Mano de obra
              </p>
              <ul className="space-y-1">
                {laborItems.map((item, i) => (
                  <li key={i} className="flex justify-between text-sm text-slate-300">
                    <span>
                      {item.qty}× {item.description}
                    </span>
                    <span>${(item.qty * item.unit_price).toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {partItems.length > 0 && (
            <div className="mb-3">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-orange-400">
                Repuestos
              </p>
              <ul className="space-y-1">
                {partItems.map((item, i) => (
                  <li key={i} className="flex justify-between text-sm text-slate-300">
                    <span>
                      {item.qty}× {item.description}
                    </span>
                    <span>${(item.qty * item.unit_price).toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {supplyItems.length > 0 && (
            <div className="mb-3">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-orange-400">
                Insumos
              </p>
              <ul className="space-y-1">
                {supplyItems.map((item, i) => (
                  <li key={i} className="flex justify-between text-sm text-slate-300">
                    <span>
                      {item.qty}× {item.description}
                    </span>
                    <span>${(item.qty * item.unit_price).toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-3 border-t border-slate-700 pt-3">
            <div className="flex justify-between text-sm font-bold text-white">
              <span>Costo estimado total</span>
              <span className="text-orange-400">${totalCost.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* CTA WhatsApp — solo si está cerca o vencido */}
      {workshopWhatsapp && alertLevel !== null && alertLevel !== 'ok' && (
        <button
          type="button"
          onClick={handleWhatsApp}
          className="mt-5 w-full rounded-xl bg-green-600 py-3 font-semibold text-white hover:bg-green-700 transition-colors"
        >
          Agendar mantenimiento por WhatsApp
        </button>
      )}

      {/* Nota legal */}
      <p className="mt-5 text-xs text-slate-500 border-t border-slate-800 pt-4 leading-relaxed">
        Esta es una recomendación de mantenimiento basada en el historial del vehículo. Al momento de la revisión, el vehículo será inspeccionado íntegramente. En caso de encontrarse piezas defectuosas o componentes que requieran atención, estos serán incluidos en la proforma como valor adicional, previa aprobación del cliente.
      </p>
    </section>
  )
}
