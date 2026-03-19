'use client'

import { useEffect, useRef, useState } from 'react'

type Photo = { id: string; url: string; created_at: string }
type Item = { id: string; category: string; description: string; qty: number; unit_price: number; priority: string; completed: boolean }

const PRIORITY_META: Record<string, { emoji: string }> = {
  urgente:    { emoji: '🔴' },
  recomendado:{ emoji: '🟡' },
  opcional:   { emoji: '🟢' },
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
  const fileRef = useRef<HTMLInputElement>(null)

  const authorized = authorizedPriorities?.split(',').filter(Boolean) || []

  async function loadAll() {
    setLoading(true)
    try {
      const [photosRes, itemsRes] = await Promise.all([
        fetch(`/api/admin/orders/${orderId}/photos?type=process`),
        fetch(`/api/admin/orders/${orderId}/quote-items`),
      ])
      if (photosRes.ok) setPhotos(await photosRes.json())
      if (itemsRes.ok) {
        const all: Item[] = await itemsRes.json()
        setItems(authorized.length > 0 ? all.filter((i) => authorized.includes(i.priority)) : all)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [orderId])

  async function toggleComplete(itemId: string, current: boolean) {
    const res = await fetch(`/api/admin/orders/${orderId}/quote-items`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId, completed: !current }),
    })
    if (res.ok) setItems((prev) => prev.map((i) => i.id === itemId ? { ...i, completed: !current } : i))
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
        const res = await fetch(`/api/admin/orders/${orderId}/photos`, { method: 'POST', body: fd })
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
    const res = await fetch(`/api/admin/orders/${orderId}/photos?photoId=${photoId}`, { method: 'DELETE' })
    if (res.ok) setPhotos((prev) => prev.filter((p) => p.id !== photoId))
  }

  const completedCount = items.filter((i) => i.completed).length

  return (
    <div className="rounded-xl border border-blue-800/40 bg-blue-950/10 p-4 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-white">En proceso</h3>
          <p className="text-sm text-slate-400">Checklist de trabajo y fotos del proceso.</p>
        </div>
        {items.length > 0 && (
          <span className="text-sm font-bold text-blue-300">
            {completedCount}/{items.length} ✓
          </span>
        )}
      </div>

      {/* Checklist */}
      {items.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-400 mb-2">
            Checklist autorizado
          </p>
          <ul className="space-y-2">
            {items.map((item) => (
              <li
                key={item.id}
                onClick={() => toggleComplete(item.id, item.completed)}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${
                  item.completed
                    ? 'border-green-800/40 bg-green-950/20'
                    : 'border-slate-700 bg-slate-900/50 hover:bg-slate-800/60'
                }`}
              >
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs font-bold ${
                  item.completed ? 'border-green-500 bg-green-500 text-white' : 'border-slate-600 bg-slate-800 text-slate-400'
                }`}>
                  {item.completed ? '✓' : ''}
                </span>
                <span className={`text-sm flex-1 ${item.completed ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                  {PRIORITY_META[item.priority]?.emoji} {item.qty}× {item.description}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Fotos del proceso */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-400 mb-2">
          Fotos del proceso
        </p>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="rounded-lg border border-dashed border-blue-700/50 bg-slate-900 hover:bg-slate-800 px-4 py-3 text-sm text-slate-300 disabled:opacity-60 w-full text-center"
        >
          {uploading ? 'Subiendo...' : '+ Agregar foto(s) del proceso'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />

        {loading ? (
          <p className="mt-3 text-sm text-slate-400">Cargando...</p>
        ) : photos.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Sin fotos del proceso aún.</p>
        ) : (
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {photos.map((photo) => (
              <div key={photo.id} className="relative group">
                <img
                  src={photo.url}
                  alt="Foto del proceso"
                  className="h-24 w-full rounded-lg object-cover border border-blue-800/40"
                />
                <button
                  type="button"
                  onClick={() => deletePhoto(photo.id)}
                  className="absolute top-1 right-1 hidden group-hover:flex items-center justify-center w-6 h-6 rounded-full bg-red-600 text-white text-xs font-bold"
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
