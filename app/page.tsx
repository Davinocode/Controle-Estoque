'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const PERSONAS = ['Kiko', 'Felipe Dapper', 'Felipe Satunga', 'Willian Barcelos', 'Guilherme', 'Gestor']

export default function Home() {
  const [persona, setPersona] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [verificando, setVerificando] = useState(false)
  const router = useRouter()

  function entrar() {
    if (!persona) return
    if (persona === 'Gestor') {
      setMostrarSenha(true)
      return
    }
    localStorage.setItem('persona', persona)
    router.push('/registrar')
  }

  async function confirmarSenha() {
    if (!senha) return
    setVerificando(true)
    setErro('')
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senha }),
      })
      if (res.ok) {
        localStorage.setItem('persona', 'Gestor')
        localStorage.setItem('gestor_auth', '1')
        router.push('/painel')
      } else {
        setErro('Senha incorreta')
        setSenha('')
      }
    } finally {
      setVerificando(false)
    }
  }

  function fecharModal() {
    setMostrarSenha(false)
    setSenha('')
    setErro('')
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

      {/* Modal de senha do gestor */}
      {mostrarSenha && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Acesso do Gestor</h2>
            <p className="text-sm text-gray-500 mb-5">Digite a senha para continuar</p>

            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && confirmarSenha()}
              placeholder="Senha"
              autoFocus
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-lg focus:border-blue-400 focus:outline-none mb-3"
            />

            {erro && (
              <p className="text-red-600 text-sm mb-3 text-center">{erro}</p>
            )}

            <button
              onClick={confirmarSenha}
              disabled={!senha || verificando}
              className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl disabled:opacity-40 hover:bg-blue-700 transition-colors mb-2"
            >
              {verificando ? 'Verificando...' : 'Confirmar'}
            </button>
            <button
              onClick={fecharModal}
              className="w-full py-2 text-gray-500 text-sm hover:text-gray-700"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
