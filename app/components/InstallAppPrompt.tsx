'use client'

import { useEffect, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

function isStandalone() {
  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean }

  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean(navigatorWithStandalone.standalone)
  )
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
}

export default function InstallAppPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIOSHelp, setShowIOSHelp] = useState(false)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    if (isStandalone()) {
      window.setTimeout(() => setHidden(true), 0)
      return
    }

    if (isIOS()) {
      window.setTimeout(() => setShowIOSHelp(true), 0)
    }

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault()
      setPromptEvent(event as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  async function install() {
    if (!promptEvent) return

    await promptEvent.prompt()
    const choice = await promptEvent.userChoice
    if (choice.outcome === 'accepted') {
      setHidden(true)
    }
    setPromptEvent(null)
  }

  if (hidden || (!promptEvent && !showIOSHelp)) return null

  return (
    <section className="rounded-2xl border border-orange-500/30 bg-slate-900 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-white">Guardar FINECAR en mi teléfono</p>
          <p className="mt-1 text-sm text-slate-400">
            Acceso directo para revisar tu orden y recibir avisos del taller.
          </p>
          {showIOSHelp && (
            <p className="mt-2 text-xs text-slate-500">
              iPhone: toca Compartir y luego Agregar a pantalla de inicio.
            </p>
          )}
        </div>

        {promptEvent ? (
          <button
            type="button"
            onClick={install}
            className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600"
          >
            Instalar
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setHidden(true)}
            className="rounded-xl border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-800"
          >
            Entendido
          </button>
        )}
      </div>
    </section>
  )
}
