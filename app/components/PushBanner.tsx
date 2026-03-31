'use client'

import { useState, useEffect } from 'react'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

export default function PushBanner({ orderId }: { orderId: string }) {
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return
    if (Notification.permission === 'default') {
      setVisible(true)
    }
  }, [])

  async function activate() {
    setLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      })
      await fetch('/api/push-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub, orderId }),
      })
      setDone(true)
      setTimeout(() => setVisible(false), 3000)
    } catch {
      setVisible(false)
    } finally {
      setLoading(false)
    }
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4">
      <div className="mx-auto max-w-lg rounded-2xl border border-orange-500/40 bg-slate-900 p-4 shadow-2xl">
        {done ? (
          <div className="flex items-center gap-3 text-green-300">
            <span className="text-2xl">✅</span>
            <div>
              <p className="font-semibold">Notificaciones activadas</p>
              <p className="text-sm text-slate-400">Te avisaremos antes de tu próximo mantenimiento</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔔</span>
            <div className="flex-1">
              <p className="font-semibold text-white">Recibe alertas de mantenimiento</p>
              <p className="text-sm text-slate-400">Te avisamos antes de que venza tu próximo servicio</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setVisible(false)}
                className="rounded-lg px-3 py-2 text-sm text-slate-400 hover:text-white"
              >
                Ahora no
              </button>
              <button
                onClick={activate}
                disabled={loading}
                className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {loading ? '...' : 'Activar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
