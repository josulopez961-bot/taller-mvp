'use client'

import { useEffect, useRef, useState } from 'react'

type Photo = {
  id: string
  url: string
  created_at: string
}

export default function OrderPhotos({ orderId }: { orderId: string }) {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [receptionNotes, setReceptionNotes] = useState('')
  const [notesSaved, setNotesSaved] = useState(false)
  const [savingNotes, setSavingNotes] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function loadPhotos() {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/photos`)
      const data = await res.json()
      if (res.ok) setPhotos(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }

  async function loadNotes() {
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/reception-notes`)
      if (res.ok) {
        const data = await res.json()
        setReceptionNotes(data.reception_notes || '')
      }
    } catch {}
  }

  useEffect(() => {
    loadPhotos()
    loadNotes()
  }, [orderId])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData()
        fd.append('file', file)
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
    if (res.ok) {
      setPhotos((prev) => prev.filter((p) => p.id !== photoId))
    }
  }

  async function saveNotes() {
    setSavingNotes(true)
    try {
      await fetch(`/api/admin/orders/${orderId}/reception-notes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reception_notes: receptionNotes }),
      })
      setNotesSaved(true)
      setTimeout(() => setNotesSaved(false), 2000)
    } finally {
      setSavingNotes(false)
    }
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 space-y-5">
      <div>
        <h3 className="font-semibold text-white">Recepción del vehículo</h3>
        <p className="text-sm text-zinc-400">Fotos de entrada y observaciones al recibir.</p>
      </div>

      {/* Observaciones */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-widest text-orange-400 mb-2">
          Observaciones al recibir
        </label>
        <div className="flex gap-2">
          <textarea
            value={receptionNotes}
            onChange={(e) => setReceptionNotes(e.target.value)}
            placeholder="Ej: rayón en puerta trasera, espejo roto, sin tapón de aceite..."
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white text-sm outline-none focus:border-orange-500 min-h-[72px]"
          />
          <button
            type="button"
            onClick={saveNotes}
            disabled={savingNotes}
            className="self-end rounded-lg bg-orange-600 hover:bg-orange-700 px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            {notesSaved ? '✓ Guardado' : savingNotes ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>

      {/* Fotos */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-widest text-orange-400 mb-2">
          Fotos de entrada
        </label>

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="rounded-lg border border-dashed border-zinc-600 bg-zinc-900 hover:bg-zinc-800 px-4 py-3 text-sm text-zinc-300 disabled:opacity-60 w-full text-center"
        >
          {uploading ? 'Subiendo...' : '+ Agregar foto(s)'}
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
          <p className="mt-3 text-sm text-zinc-400">Cargando fotos...</p>
        ) : photos.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">Sin fotos aún.</p>
        ) : (
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {photos.map((photo) => (
              <div key={photo.id} className="relative group">
                <img
                  src={photo.url}
                  alt="Foto de entrada"
                  className="h-24 w-full rounded-lg object-cover border border-zinc-700"
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
