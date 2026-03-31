'use client'

import { useState, useEffect } from 'react'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

export default function PushSubscribeButton({ orderId }: { orderId: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'subscribed' | 'denied' | 'error'>('idle')

  useEffect(() => {
    if (!('Notification' in window)) return
    if (Notification.permission === 'denied') setState('denied')
  }, [])

  async function subscribe() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('error')
      return
    }
    setState('loading')
    try {
      const reg = await navigator.serviceWorker.ready
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })
      const res = await fetch('/api/push-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub, orderId }),
      })
      if (!res.ok) throw new Error()
      setState('subscribed')
    } catch {
      setState('error')
    }
  }

  if (state === 'subscribed') {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-green-700 bg-green-900/20 px-4 py-3 text-sm text-green-300">
        <span>🔔</span>
        <span>Notificaciones activadas — te avisaremos cuando haya novedades</span>
      </div>
    )
  }

  if (state === 'denied') {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-slate-400">
        <span>🔕</span>
        <span>Notificaciones bloqueadas en tu navegador</span>
      </div>
    )
  }

  return (
    <button
      onClick={subscribe}
      disabled={state === 'loading'}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-orange-500 bg-orange-500/10 px-4 py-3 text-sm font-semibold text-orange-300 transition hover:bg-orange-500/20 disabled:opacity-50"
    >
      {state === 'loading' ? (
        <>
          <span className="animate-spin">⏳</span>
          <span>Activando...</span>
        </>
      ) : (
        <>
          <span>🔔</span>
          <span>Activar notificaciones de progreso</span>
        </>
      )}
    </button>
  )
}
