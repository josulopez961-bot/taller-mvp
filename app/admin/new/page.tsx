'use client'

import { useState } from 'react'

export default function NewOrderPage() {
  const [form, setForm] = useState({
    plate: '',
    customer_name: '',
    whatsapp: '',
    make: '',
    model: '',
    year: '',
    summary: '',
  })

  const [loading, setLoading] = useState(false)

  function updateField(key: string, value: string) {
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
        setLoading(false)
        return
      }

      const link = `${window.location.origin}/o/${data.code}`
      await navigator.clipboard.writeText(link)

      alert(`Orden creada: ${data.code}\nLink copiado:\n${link}`)
    } catch {
      alert('Error al crear la orden')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white p-10">
      <h1 className="text-3xl font-bold mb-6">Nueva Orden</h1>

      <div className="grid gap-4 max-w-2xl">
        <input
          className="p-3 rounded bg-zinc-900 border border-zinc-700"
          placeholder="Placa"
          value={form.plate}
          onChange={(e) => updateField('plate', e.target.value.toUpperCase())}
        />

        <input
          className="p-3 rounded bg-zinc-900 border border-zinc-700"
          placeholder="Nombre del cliente"
          value={form.customer_name}
          onChange={(e) => updateField('customer_name', e.target.value)}
        />

        <input
          className="p-3 rounded bg-zinc-900 border border-zinc-700"
          placeholder="WhatsApp"
          value={form.whatsapp}
          onChange={(e) => updateField('whatsapp', e.target.value)}
        />

        <div className="grid grid-cols-3 gap-4">
          <input
            className="p-3 rounded bg-zinc-900 border border-zinc-700"
            placeholder="Marca"
            value={form.make}
            onChange={(e) => updateField('make', e.target.value)}
          />

          <input
            className="p-3 rounded bg-zinc-900 border border-zinc-700"
            placeholder="Modelo"
            value={form.model}
            onChange={(e) => updateField('model', e.target.value)}
          />

          <input
            className="p-3 rounded bg-zinc-900 border border-zinc-700"
            placeholder="Año"
            value={form.year}
            onChange={(e) => updateField('year', e.target.value)}
          />
        </div>

        <textarea
          className="p-3 rounded bg-zinc-900 border border-zinc-700 min-h-[120px]"
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
  )
}
