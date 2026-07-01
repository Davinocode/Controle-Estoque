'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Estoque = { codigo: string; nome: string | null; tipo: string }

export default function RegistrarPage() {
  const [estoques, setEstoques] = useState<Estoque[]>([])
  const [persona, setPersona] = useState('')
  const [carregando, setCarregando] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const p = localStorage.getItem('persona')
    if (!p) { router.push('/'); return }
    if (p === 'Gestor') { router.push('/painel'); return }
    setPersona(p)

    fetch('/api/estoques')
      .then((r) => r.json())
      .then((data: Estoque[]) => {
        const lista = p === 'Guilherme'
          ? data.filter((e) => e.codigo === '011')
          : data.filter((e) => e.codigo !== '011')
        setEstoques(lista)
        setCarregando(false)
      })
  }, [router])

  function nomeEstoque(e: Estoque) {
    if (e.nome) return e.nome
    return e.tipo === 'cd' ? `CD ${e.codigo}` : `Loja ${e.codigo}`
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-10">
      <div className="max-w-sm mx-auto">
        <div className="bg-white border-b px-4 py-4 flex items-center gap-3">
          <Link href="/" className="text-gray-400 hover:text-gray-600 text-xl font-light">←</Link>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Selecionar Estoque</h1>
            <p className="text-xs text-gray-500">{persona}</p>
          </div>
        </div>

        <div className="p-4 space-y-2">
          {carregando && (
            <p className="text-center text-gray-400 py-8">Carregando...</p>
          )}
          {!carregando && estoques.length === 0 && (
            <p className="text-center text-gray-400 py-8">Nenhum estoque disponível</p>
          )}
          {estoques.map((e) => (
            <Link
              key={e.codigo}
              href={`/contagem/${e.codigo}`}
              className="flex items-center justify-between w-full px-4 py-4 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 active:bg-blue-100 transition-colors"
            >
              <div>
                <p className="font-semibold text-gray-900">{nomeEstoque(e)}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {e.tipo === 'cd' ? 'Centro de Distribuição' : 'Loja'} · {e.codigo}
                </p>
              </div>
              <span className="text-gray-300 text-lg">›</span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  )
}
