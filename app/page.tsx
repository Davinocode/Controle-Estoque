'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const PERSONAS = ['Kiko', 'Felipe Dapper', 'Felipe Satunga', 'Willian Barcelos', 'Guilherme', 'Gestor']

export default function Home() {
  const [persona, setPersona] = useState('')
  const router = useRouter()

  function entrar() {
    if (!persona) return
    localStorage.setItem('persona', persona)
    if (persona === 'Gestor') {
      router.push('/painel')
    } else {
      router.push('/registrar')
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Controle de Estoque</h1>
          <p className="text-gray-500 text-sm mt-1">Selecione seu nome para continuar</p>
        </div>

        <div className="space-y-2 mb-6">
          {PERSONAS.map((p) => (
            <button
              key={p}
              onClick={() => setPersona(p)}
              className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${
                persona === p
                  ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold'
                  : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        <button
          onClick={entrar}
          disabled={!persona}
          className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold text-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-700 active:bg-blue-800 transition-colors"
        >
          Entrar
        </button>
      </div>
    </main>
  )
}
