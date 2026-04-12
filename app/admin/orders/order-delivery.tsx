'use client'

import { useEffect, useRef, useState } from 'react'

type Photo = { id: string; url: string; created_at: string }

export default function OrderDelivery({ orderId }: { orderId: string }) {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loadingPhotos, setLoadingPhotos] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [invoiceUploading, setInvoiceUploading] = useState(false)
  const [invoiceDeleting, setInvoiceDeleting] = useState(false)
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null)
  const [invoiceFileName, setInvoiceFileName] = useState<string | null>(null)

  const [recommendations, setRecommendations] = useState('')
  const [savingRec, setSavingRec] = useState(false)
  const [recSaved, setRecSaved] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)
  const invoiceRef = useRef<HTMLInputElement>(null)

  async function loadAll() {
    setLoadingPhotos(true)
    try {
      const [photosRes, recRes, invoiceRes] = await Promise.all([
        fetch(`/api/admin/orders/${orderId}/photos?type=delivery`),
        fetch(`/api/admin/orders/${orderId}/recommendations`),
        fetch(`/api/admin/orders/${orderId}/invoice`),
      ])
      if (photosRes.ok) setPhotos(await photosRes.json())
      if (recRes.ok) {
        const d = await recRes.json()
        setRecommendations(d.recommendations || '')
      }
      if (invoiceRes.ok) {
        const d = await invoiceRes.json()
        setInvoiceUrl(d.invoice_url || null)
        setInvoiceFileName(d.invoice_file_name || null)
      }
    } finally {
      setLoadingPhotos(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [orderId])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('photo_type', 'delivery')
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

  async function handleInvoiceUpload(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const files = e.target.files
    if (!files || files.length === 0) return

    setInvoiceUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', files[0])
      const res = await fetch(`/api/admin/orders/${orderId}/invoice`, {
        method: 'POST',
        body: fd,
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'No se pudo subir la factura')
        return
      }
      setInvoiceUrl(data.invoice_url || null)
      setInvoiceFileName(data.invoice_file_name || null)
    } finally {
      setInvoiceUploading(false)
      if (invoiceRef.current) invoiceRef.current.value = ''
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

  async function deleteInvoice() {
    if (!confirm('¿Eliminar la factura cargada?')) return
    setInvoiceDeleting(true)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/invoice`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setInvoiceUrl(null)
        setInvoiceFileName(null)
      }
    } finally {
      setInvoiceDeleting(false)
    }
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
    <div className="space-y-5 rounded-xl border border-emerald-800/40 bg-emerald-950/10 p-4">
      <div>
        <h3 className="font-semibold text-white">Evidencia de entrega</h3>
        <p className="text-sm text-slate-400">
          Fotos de salida, recomendaciones y factura digital.
        </p>
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-emerald-400">
          Factura digital
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => invoiceRef.current?.click()}
            disabled={invoiceUploading}
            className="rounded-lg border border-dashed border-emerald-700/50 bg-slate-900 px-4 py-3 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-60"
          >
            {invoiceUploading ? 'Subiendo...' : invoiceUrl ? 'Reemplazar factura' : '+ Subir factura'}
          </button>
          <input
            ref={invoiceRef}
            type="file"
            accept=".pdf,image/*"
            className="hidden"
            onChange={handleInvoiceUpload}
          />
          {invoiceUrl && (
            <>
              <a
                href={invoiceUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-emerald-700 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-600"
              >
                Ver factura
              </a>
              <button
                type="button"
                onClick={deleteInvoice}
                disabled={invoiceDeleting}
                className="rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm font-medium text-red-300 hover:bg-red-900/50 disabled:opacity-60"
              >
                {invoiceDeleting ? 'Eliminando...' : 'Eliminar factura'}
              </button>
            </>
          )}
        </div>
        {invoiceFileName && (
          <p className="mt-2 text-sm text-slate-400">{invoiceFileName}</p>
        )}
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-emerald-400">
          Recomendaciones al cliente
        </label>
        <div className="flex gap-2">
          <textarea
            value={recommendations}
            onChange={(e) => setRecommendations(e.target.value)}
            placeholder="Ej: revisar presión de neumáticos cada 2 semanas, cambiar pastillas en 5000 km..."
            className="min-h-[80px] flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
          />
          <button
            type="button"
            onClick={saveRecommendations}
            disabled={savingRec}
            className="self-end rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium hover:bg-emerald-600 disabled:opacity-60"
          >
            {recSaved ? '✓ Guardado' : savingRec ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-emerald-400">
          Fotos de salida
        </label>

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="w-full rounded-lg border border-dashed border-emerald-700/50 bg-slate-900 px-4 py-3 text-center text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-60"
        >
          {uploading ? 'Subiendo...' : '+ Agregar foto(s) de salida'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleUpload}
        />

        {loadingPhotos ? (
          <p className="mt-3 text-sm text-slate-400">Cargando...</p>
        ) : photos.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Sin fotos de salida aún.</p>
        ) : (
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {photos.map((photo) => (
              <div key={photo.id} className="group relative">
                <img
                  src={photo.url}
                  alt="Foto de salida"
                  className="h-24 w-full rounded-lg border border-emerald-800/40 object-cover"
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
