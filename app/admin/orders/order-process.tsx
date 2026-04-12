'use client'

import { useEffect, useRef, useState } from 'react'

type Photo = { id: string; url: string; created_at: string }
type Item = {
  id: string
  category: string
  description: string
  qty: number
  unit_price: number
  priority: string
  completed: boolean
}

const PRIORITY_META: Record<string, { emoji: string }> = {
  urgente: { emoji: '🔴' },
  recomendado: { emoji: '🟡' },
  opcional: { emoji: '🟢' },
}

export default function OrderProcess({
  orderId,
  authorizedPriorities,
}: {
  orderId: string
  authorizedPriorities?: string | null
}) {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [scopeText, setScopeText] = useState('')
  const [savingScope, setSavingScope] = useState(false)
  const [scopeSaved, setScopeSaved] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const authorized = authorizedPriorities?.split(',').filter(Boolean) || []

  async function loadAll() {
    setLoading(true)
    try {
      const [photosRes, itemsRes, scopeRes] = await Promise.all([
        fetch(`/api/admin/orders/${orderId}/photos?type=process`),
        fetch(`/api/admin/orders/${orderId}/quote-items`),
        fetch(`/api/admin/orders/${orderId}/scope`),
      ])
      if (photosRes.ok) setPhotos(await photosRes.json())
      if (itemsRes.ok) {
        const all: Item[] = await itemsRes.json()
        setItems(
          authorized.length > 0
            ? all.filter((i) => authorized.includes(i.priority))
            : all
        )
      }
      if (scopeRes.ok) {
        const data = await scopeRes.json()
        setScopeText(data.scope_text || '')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [orderId])

  async function toggleComplete(itemId: string, current: boolean) {
    const res = await fetch(`/api/admin/orders/${orderId}/quote-items`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId, completed: !current }),
    })
    if (res.ok) {
      setItems((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, completed: !current } : i))
      )
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('photo_type', 'process')
        const res = await fetch(`/api/admin/orders/${orderId}/photos`, {
          method: 'POST',
          body: fd,
        })
        if (res.ok) {
          const photo = await res.json()
          setPhotos((prev) => [...prev, photo])
        }
      }
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function deletePhoto(photoId: string) {
    if (!confirm('¿Eliminar esta foto?')) return
    const res = await fetch(
      `/api/admin/orders/${orderId}/photos?photoId=${photoId}`,
      { method: 'DELETE' }
    )
    if (res.ok) setPhotos((prev) => prev.filter((p) => p.id !== photoId))
  }

  async function saveScope() {
    setSavingScope(true)
    try {
      await fetch(`/api/admin/orders/${orderId}/scope`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope_text: scopeText }),
      })
      setScopeSaved(true)
      setTimeout(() => setScopeSaved(false), 2000)
    } finally {
      setSavingScope(false)
    }
  }

  const completedCount = items.filter((i) => i.completed).length

  return (
    <div className="space-y-5 rounded-xl border border-blue-800/40 bg-blue-950/10 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-white">En proceso</h3>
          <p className="text-sm text-slate-400">
            Checklist de trabajo, alcance y fotos del proceso.
          </p>
        </div>
        {items.length > 0 && (
          <span className="text-sm font-bold text-blue-300">
            {completedCount}/{items.length} ✓
          </span>
        )}
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-blue-400">
          Alcance del trabajo
        </label>
        <div className="flex gap-2">
          <textarea
            value={scopeText}
            onChange={(e) => setScopeText(e.target.value)}
            placeholder="Describe el alcance en ejecución: piezas, daños, trabajo adicional o contexto para aseguradora."
            className="min-h-[90px] flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
          />
          <button
            type="button"
            onClick={saveScope}
            disabled={savingScope}
            className="self-end rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium hover:bg-blue-600 disabled:opacity-60"
          >
            {scopeSaved ? '✓ Guardado' : savingScope ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>

      {items.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-blue-400">
            Checklist autorizado
          </p>
          <ul className="space-y-2">
            {items.map((item) => (
              <li
                key={item.id}
                onClick={() => toggleComplete(item.id, item.completed)}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition-colors ${
                  item.completed
                    ? 'border-green-800/40 bg-green-950/20'
                    : 'border-slate-700 bg-slate-900/50 hover:bg-slate-800/60'
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs font-bold ${
                    item.completed
                      ? 'border-green-500 bg-green-500 text-white'
                      : 'border-slate-600 bg-slate-800 text-slate-400'
                  }`}
                >
                  {item.completed ? '✓' : ''}
                </span>
                <span
                  className={`flex-1 text-sm ${
                    item.completed ? 'text-slate-500 line-through' : 'text-slate-200'
                  }`}
                >
                  {PRIORITY_META[item.priority]?.emoji} {item.qty}× {item.description}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-blue-400">
          Fotos del proceso
        </p>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="w-full rounded-lg border border-dashed border-blue-700/50 bg-slate-900 px-4 py-3 text-center text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-60"
        >
          {uploading ? 'Subiendo...' : '+ Agregar foto(s) del proceso'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleUpload}
        />

        {loading ? (
          <p className="mt-3 text-sm text-slate-400">Cargando...</p>
        ) : photos.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Sin fotos del proceso aún.</p>
        ) : (
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {photos.map((photo) => (
              <div key={photo.id} className="group relative">
                <img
                  src={photo.url}
                  alt="Foto del proceso"
                  className="h-24 w-full rounded-lg border border-blue-800/40 object-cover"
                />
                <button
                  type="button"
                  onClick={() => deletePhoto(photo.id)}
                  className="absolute right-1 top-1 hidden h-6 w-6 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white group-hover:flex"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
