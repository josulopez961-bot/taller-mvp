'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminPage() {
  const [pass, setPass] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    setLoading(true)

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pass }),
      })

      if (!res.ok) {
        setErr('Clave incorrecta')
        setLoading(false)
        return
      }

      router.push('/admin/orders')
      router.refresh()
    } catch (error) {
      setErr('Error al iniciar sesión')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <form
        onSubmit={onSubmit}
        className="bg-white/5 border border-white/10 rounded-2xl p-8 w-full max-w-sm"
      >
        <h1 className="text-2xl font-semibold mb-6">Ingreso al Panel</h1>

        <input
          type="password"
          placeholder="Contraseña"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          className="w-full p-3 rounded-lg bg-black border border-white/20 mb-4"
        />

        {err && <p className="text-red-400 text-sm mb-3">{err}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green-600 hover:bg-green-700 transition rounded-lg py-3 font-medium disabled:opacity-60"
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
