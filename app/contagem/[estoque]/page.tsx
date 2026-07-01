'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Item = { sku: string; nome: string; categoria: string }
type Ciclo = { id: number; numero: number; encerradoEm: string | null }
type DadosSugestoes = {
  ciclo: Ciclo
  sugestoes: Item[]
  totalItens: number
  contados: number
  estoque: { codigo: string; nome: string | null; tipo: string } | null
}

export default function ContagemPage({ params }: { params: Promise<{ estoque: string }> }) {
  const { estoque } = use(params)
  const [persona, setPersona] = useState('')
  const [dados, setDados] = useState<DadosSugestoes | null>(null)
  const [busca, setBusca] = useState('')
  const [resultadosBusca, setResultadosBusca] = useState<Item[]>([])
  const [itemSelecionado, setItemSelecionado] = useState<Item | null>(null)
  const [saldo, setSaldo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [sucesso, setSucesso] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const p = localStorage.getItem('persona')
    if (!p) { router.push('/'); return }
    setPersona(p)
    carregarDados()
  }, [estoque])

  async function carregarDados() {
    const res = await fetch(`/api/sugestoes?estoque=${estoque}`)
    const data = await res.json()
    setDados(data)
  }

  useEffect(() => {
    if (busca.length < 2) { setResultadosBusca([]); return }
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/itens?busca=${encodeURIComponent(busca)}`)
      const data = await res.json()
      setResultadosBusca(data)
    }, 300)
    return () => clearTimeout(timer)
  }, [busca])

  async function registrar() {
    if (!itemSelecionado || saldo === '' || !persona) return
    setEnviando(true)
    try {
      const res = await fetch('/api/contagens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estoqueCodigo: estoque,
          sku: itemSelecionado.sku,
          contador: persona,
          saldoContado: parseInt(saldo),
        }),
      })
      const resultado = await res.json()
      if (resultado.cicloEncerrado) {
        setSucesso(`Ciclo ${dados?.ciclo.numero} concluído! Novo ciclo iniciado.`)
      } else {
        setSucesso(`"${itemSelecionado.nome}" registrado: ${saldo} unid.`)
      }
      setItemSelecionado(null)
      setSaldo('')
      setBusca('')
      setResultadosBusca([])
      await carregarDados()
    } finally {
      setEnviando(false)
    }
  }

  const progresso = dados && dados.totalItens > 0
    ? Math.round((dados.contados / dados.totalItens) * 100)
    : 0

  function nomeEstoque() {
    if (dados?.estoque?.nome) return dados.estoque.nome
    return estoque === '011' ? 'CD 011' : `Loja ${estoque}`
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-12">
      <div className="max-w-sm mx-auto">
        {/* Header */}
        <div className="bg-white border-b sticky top-0 z-10">
          <div className="px-4 py-4">
            <div className="flex items-center gap-3 mb-3">
              <Link href="/registrar" className="text-gray-400 hover:text-gray-600 text-xl">←</Link>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-bold text-gray-900 truncate">{nomeEstoque()}</h1>
                <p className="text-xs text-gray-500">{persona} · Ciclo {dados?.ciclo.numero ?? '...'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${progresso}%` }}
                />
              </div>
              <span className="text-xs font-medium text-gray-600 shrink-0">
                {dados ? `${dados.contados}/${dados.totalItens}` : '...'} ({progresso}%)
              </span>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Feedback de sucesso */}
          {sucesso && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-start justify-between">
              <p className="text-green-800 text-sm font-medium">✓ {sucesso}</p>
              <button onClick={() => setSucesso(null)} className="text-green-500 ml-3 shrink-0">✕</button>
            </div>
          )}

          {/* Formulário de registro do item selecionado */}
          {itemSelecionado ? (
            <div className="bg-white rounded-xl border-2 border-blue-300 p-4">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0 mr-2">
                  <p className="text-xs text-gray-400 font-mono">{itemSelecionado.sku}</p>
                  <p className="font-semibold text-gray-900 leading-snug">{itemSelecionado.nome}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{itemSelecionado.categoria}</p>
                </div>
                <button
                  onClick={() => { setItemSelecionado(null); setSaldo('') }}
                  className="text-gray-300 hover:text-gray-500 text-2xl leading-none shrink-0"
                >
                  ✕
                </button>
              </div>
              <p className="text-sm font-medium text-gray-600 mb-2 text-center">Quantidade contada</p>
              <input
                type="number"
                inputMode="numeric"
                value={saldo}
                onChange={(e) => setSaldo(e.target.value)}
                placeholder="0"
                min="0"
                className="w-full text-4xl font-bold border-2 border-gray-200 rounded-xl p-3 text-center focus:border-blue-400 focus:outline-none"
                autoFocus
              />
              <button
                onClick={registrar}
                disabled={saldo === '' || enviando}
                className="w-full mt-4 py-4 bg-blue-600 text-white font-bold text-lg rounded-xl disabled:opacity-40 hover:bg-blue-700 active:bg-blue-800 transition-colors"
              >
                {enviando ? 'Registrando...' : 'Confirmar'}
              </button>
            </div>
          ) : (
            <>
              {/* Busca */}
              <div>
                <input
                  type="text"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar produto por nome ou SKU..."
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white focus:border-blue-400 focus:outline-none text-sm"
                />
                {resultadosBusca.length > 0 && (
                  <div className="mt-1 bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    {resultadosBusca.map((item) => (
                      <button
                        key={item.sku}
                        onClick={() => { setItemSelecionado(item); setBusca(''); setResultadosBusca([]) }}
                        className="w-full text-left px-4 py-3 border-b border-gray-100 last:border-0 hover:bg-blue-50 active:bg-blue-100 transition-colors"
                      >
                        <p className="font-medium text-gray-900 text-sm">{item.nome}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{item.sku} · {item.categoria}</p>
                      </button>
                    ))}
                  </div>
                )}
                {busca.length >= 2 && resultadosBusca.length === 0 && (
                  <p className="text-xs text-gray-400 mt-2 px-1">Nenhum produto encontrado</p>
                )}
              </div>

              {/* Sugestões */}
              <div>
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
                  Sugeridos para contar
                </h2>
                {!dados && (
                  <p className="text-center text-gray-400 py-6 text-sm">Carregando...</p>
                )}
                {dados && dados.sugestoes.length === 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
                    <p className="text-green-800 font-semibold">Todos os itens foram contados!</p>
                    <p className="text-green-600 text-sm mt-1">Ciclo {dados.ciclo.numero} concluído.</p>
                  </div>
                )}
                {dados && dados.sugestoes.map((item) => (
                  <button
                    key={item.sku}
                    onClick={() => setItemSelecionado(item)}
                    className="w-full bg-white border border-gray-200 rounded-xl p-4 text-left hover:border-blue-300 hover:bg-blue-50 active:bg-blue-100 transition-colors mb-2"
                  >
                    <p className="font-semibold text-gray-900">{item.nome}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{item.sku} · {item.categoria}</p>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
