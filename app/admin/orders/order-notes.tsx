'use client'

import { useEffect, useState } from 'react'

type NoteItem = {
  id: string
  message: string
  created_at: string
}

export default function OrderNotes({
  orderId,
}: {
  orderId: string
}) {
  const [notes, setNotes] = useState<NoteItem[]>([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  async function loadNotes() {
    setLoading(true)

    try {
      const res = await fetch(`/api/admin/order-updates?orderId=${encodeURIComponent(orderId)}`)
      const data = await res.json()

      if (!res.ok) {
        alert(data.error || 'No se pudieron cargar las notas')
        return
      }

      setNotes(data.updates || [])
    } catch {
      alert('Error al cargar notas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadNotes()
  }, [orderId])

  async function addNote() {
    const clean = message.trim()

    if (!clean) return

    setSaving(true)

    try {
      const res = await fetch('/api/admin/order-updates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, message: clean }),
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.error || 'No se pudo guardar la nota')
        return
      }

      setNotes((prev) => [data.update, ...prev])
      setMessage('')
    } catch {
      alert('Error al guardar nota')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
      <div className="mb-4">
        <h3 className="font-semibold text-white">Notas de la orden</h3>
        <p className="text-sm text-zinc-400">
          Registra avances rápidos del trabajo.
        </p>
      </div>

      <div className="flex flex-col gap-3 md:flex-row">
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ej: diagnóstico iniciado, repuesto pedido, vehículo en pruebas..."
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white outline-none focus:border-green-500"
        />
        <button
          type="button"
          onClick={addNote}
          disabled={saving}
          className="rounded-lg bg-green-600 px-4 py-2 font-medium hover:bg-green-700 disabled:opacity-60"
        >
          {saving ? 'Guardando...' : 'Agregar nota'}
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {loading ? (
          <div className="text-sm text-zinc-400">Cargando notas...</div>
        ) : notes.length === 0 ? (
          <div className="text-sm text-zinc-400">Esta orden todavía no tiene notas.</div>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-3"
            >
              <div className="text-sm text-white">{note.message}</div>
              <div className="mt-1 text-xs text-zinc-400">
                {new Date(note.created_at).toLocaleString()}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
