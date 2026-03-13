'use client'

import { useEffect, useRef, useState } from 'react'

type Photo = { id: string; url: string; created_at: string }

export default function OrderDelivery({ orderId }: { orderId: string }) {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loadingPhotos, setLoadingPhotos] = useState(true)
  const [uploading, setUploading] = useState(false)

  const [recommendations, setRecommendations] = useState('')
  const [savingRec, setSavingRec] = useState(false)
  const [recSaved, setRecSaved] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)

  async function loadAll() {
    setLoadingPhotos(true)
    try {
      const [photosRes, recRes] = await Promise.all([
        fetch(`/api/admin/orders/${orderId}/photos?type=delivery`),
        fetch(`/api/admin/orders/${orderId}/recommendations`),
      ])
      if (photosRes.ok) setPhotos(await photosRes.json())
      if (recRes.ok) {
        const d = await recRes.json()
        setRecommendations(d.recommendations || '')
      }
    } finally {
      setLoadingPhotos(false)
    }
  }

  useEffect(() => { loadAll() }, [orderId])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('photo_type', 'delivery')
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

  async function saveRecommendations() {
    setSavingRec(true)
    try {
      await fetch(`/api/admin/orders/${orderId}/recommendations`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recommendations }),
      })
      setRecSaved(true)
      setTimeout(() => setRecSaved(false), 2000)
    } finally {
      setSavingRec(false)
    }
  }

  return (
    <div className="rounded-xl border border-emerald-800/40 bg-emerald-950/10 p-4 space-y-5">
      <div>
        <h3 className="font-semibold text-white">Evidencia de entrega</h3>
        <p className="text-sm text-slate-400">Fotos de salida y recomendaciones al cliente.</p>
      </div>

      {/* Recomendaciones */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-widest text-emerald-400 mb-2">
          Recomendaciones al cliente
        </label>
        <div className="flex gap-2">
          <textarea
            value={recommendations}
            onChange={(e) => setRecommendations(e.target.value)}
            placeholder="Ej: revisar presión de neumáticos cada 2 semanas, cambiar pastillas en 5000 km..."
            className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white text-sm outline-none focus:border-emerald-500 min-h-[80px]"
          />
          <button
            type="button"
            onClick={saveRecommendations}
            disabled={savingRec}
            className="self-end rounded-lg bg-emerald-700 hover:bg-emerald-600 px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            {recSaved ? '✓ Guardado' : savingRec ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>

      {/* Fotos de salida */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-widest text-emerald-400 mb-2">
          Fotos de salida
        </label>

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="rounded-lg border border-dashed border-emerald-700/50 bg-slate-900 hover:bg-slate-800 px-4 py-3 text-sm text-slate-300 disabled:opacity-60 w-full text-center"
        >
          {uploading ? 'Subiendo...' : '+ Agregar foto(s) de salida'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />

        {loadingPhotos ? (
          <p className="mt-3 text-sm text-slate-400">Cargando...</p>
        ) : photos.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Sin fotos de salida aún.</p>
        ) : (
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {photos.map((photo) => (
              <div key={photo.id} className="relative group">
                <img
                  src={photo.url}
                  alt="Foto de salida"
                  className="h-24 w-full rounded-lg object-cover border border-emerald-800/40"
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
