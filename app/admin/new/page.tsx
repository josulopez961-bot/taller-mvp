'use client'

import { useState } from 'react'

export default function NewOrder() {
  const [loading, setLoading] = useState(false)

  async function createOrder() {
    setLoading(true)

    try {
      const res = await fetch('/api/admin/create-order', {
        method: 'POST',
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
    } catch (error) {
      alert('Error al crear la orden')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white p-10">
      <h1 className="text-3xl font-bold mb-6">Nueva Orden</h1>

      <button
        onClick={createOrder}
        className="bg-green-600 px-6 py-3 rounded-lg disabled:opacity-50"
        disabled={loading}
      >
        {loading ? 'Creando...' : 'Crear Orden'}
      </button>
    </div>
  )
}
