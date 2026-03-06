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
    } catch (error) {
      setErr('Error al conectar con el servidor')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white p-4">
      <form
        onSubmit={onSubmit}
        className="bg-white/5 border border-white/10 rounded-2xl p-8 w-full max-w-sm backdrop-blur-sm"
      >
        <div className="mb-8 flex flex-col items-center">
          <div className="h-12 w-12 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center mb-4">
            <span className="text-xl font-bold">FC</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Taller Finecar</h1>
          <p className="text-xs text-white/40 uppercase tracking-widest mt-1">Admin Panel</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase mb-2 block">Acceso Restringido</label>
            <input
              type="password"
              placeholder="Ingrese Contraseña"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              className="w-full p-4 rounded-xl bg-black border border-white/10 focus:border-green-600 transition outline-none"
              autoFocus
            />
          </div>

          {err && <p className="text-red-500 text-sm font-medium">{err}</p>}

          <button
            type="submit"
            disabled={loading}
            className={`w-full bg-green-600 hover:bg-green-500 active:scale-[0.98] transition-all rounded-xl py-4 font-bold ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {loading ? 'Verificando...' : 'Entrar al Panel'}
          </button>
        </div>
      </form>
    </div>
  )
}
