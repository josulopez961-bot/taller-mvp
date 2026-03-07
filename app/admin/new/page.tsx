'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

type FormState = {
  plate: string
  customer_name: string
  whatsapp: string
  make: string
  model: string
  year: string
  summary: string
}

const initialForm: FormState = {
  plate: '',
  customer_name: '',
  whatsapp: '',
  make: '',
  model: '',
  year: '',
  summary: '',
}

export default function NewOrderPage() {
  const router = useRouter()

  const [form, setForm] = useState<FormState>(initialForm)
  const [loading, setLoading] = useState(false)

  function updateField(key: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function createOrder() {
    setLoading(true)

    try {
      const res = await fetch('/api/admin/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.error || 'No se pudo crear la orden')
        return
      }

      const link = `https://taller-mvp.vercel.app/o/${data.code}`

      try {
        await navigator.clipboard.writeText(link)
      } catch {}

      setForm(initialForm)
      router.push('/admin/orders')
    } catch {
      alert('Error al crear la orden')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white px-6 py-10">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold mb-2">Nueva Orden</h1>
        <p className="text-zinc-400 mb-8">
          Registra el vehículo y crea la orden rápidamente.
        </p>

        <div className="grid gap-4">
          <input
            className="p-3 rounded-lg bg-zinc-900 border border-zinc-700 outline-none focus:border-green-500"
            placeholder="Placa"
            value={form.plate}
            onChange={(e) => updateField('plate', e.target.value.toUpperCase())}
          />

          <input
            className="p-3 rounded-lg bg-zinc-900 border border-zinc-700 outline-none focus:border-green-500"
            placeholder="Nombre del cliente"
            value={form.customer_name}
            onChange={(e) => updateField('customer_name', e.target.value)}
          />

          <input
            className="p-3 rounded-lg bg-zinc-900 border border-zinc-700 outline-none focus:border-green-500"
            placeholder="WhatsApp"
            value={form.whatsapp}
            onChange={(e) => updateField('whatsapp', e.target.value)}
          />

          <div className="grid md:grid-cols-3 gap-4">
            <input
              className="p-3 rounded-lg bg-zinc-900 border border-zinc-700 outline-none focus:border-green-500"
              placeholder="Marca"
              value={form.make}
              onChange={(e) => updateField('make', e.target.value)}
            />

            <input
              className="p-3 rounded-lg bg-zinc-900 border border-zinc-700 outline-none focus:border-green-500"
              placeholder="Modelo"
              value={form.model}
              onChange={(e) => updateField('model', e.target.value)}
            />

            <input
              className="p-3 rounded-lg bg-zinc-900 border border-zinc-700 outline-none focus:border-green-500"
              placeholder="Año"
              value={form.year}
              onChange={(e) => updateField('year', e.target.value)}
            />
          </div>

          <textarea
            className="p-3 rounded-lg bg-zinc-900 border border-zinc-700 min-h-[140px] outline-none focus:border-green-500"
            placeholder="Servicio / detalle"
            value={form.summary}
            onChange={(e) => updateField('summary', e.target.value)}
          />

          <button
            onClick={createOrder}
            disabled={loading}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-60 px-6 py-3 rounded-lg font-semibold"
          >
            {loading ? 'Creando...' : 'Crear Orden'}
          </button>
        </div>
      </div>
    </div>
  )
}

