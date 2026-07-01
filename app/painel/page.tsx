'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Tab = 'visao-geral' | 'lista' | 'conferencia' | 'produtos'

// ─── Tipos ───────────────────────────────────────────────────────────────────

type Estoque = { codigo: string; nome: string | null; tipo: string }
type Item = { sku: string; nome: string; categoria: string; precoCusto: number }
type Contagem = {
  id: number
  dataHora: string
  estoqueCodigo: string
  sku: string
  contador: string
  saldoContado: number
  numeroCiclo: number
  saldoSistema: number | null
  divergencia: number | null
  valorDivergencia: number | null
  status: string
  item: Item
  estoque: Estoque
}
type DadosPainel = {
  estoque: Estoque
  ciclo: { id: number; numero: number }
  totalItens: number
  contados: number
  progresso: number
  ultimaContagem: (Contagem & { item: Item }) | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function formatMoeda(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function nomeEstoque(e: Estoque) {
  if (e.nome) return e.nome
  return e.tipo === 'cd' ? `CD ${e.codigo}` : `Loja ${e.codigo}`
}

// ─── Exportar CSV ────────────────────────────────────────────────────────────

function ExportarCSV() {
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [estoque, setEstoque] = useState('')
  const [estoques, setEstoques] = useState<Estoque[]>([])

  useEffect(() => {
    fetch('/api/estoques').then((r) => r.json()).then(setEstoques)
  }, [])

  function baixar() {
    const params = new URLSearchParams()
    if (estoque) params.set('estoque', estoque)
    if (de) params.set('de', de)
    if (ate) params.set('ate', ate)
    window.location.href = `/api/export?${params}`
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 mb-5">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">Exportar para planilha (CSV)</h2>
      <div className="flex flex-wrap gap-2">
        <select
          value={estoque}
          onChange={(e) => setEstoque(e.target.value)}
          className="flex-1 min-w-32 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="">Todos os estoques</option>
          {estoques.map((e) => (
            <option key={e.codigo} value={e.codigo}>{nomeEstoque(e)}</option>
          ))}
        </select>
        <input
          type="date"
          value={de}
          onChange={(e) => setDe(e.target.value)}
          className="flex-1 min-w-32 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
          title="Data início"
        />
        <input
          type="date"
          value={ate}
          onChange={(e) => setAte(e.target.value)}
          className="flex-1 min-w-32 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
          title="Data fim"
        />
        <button
          onClick={baixar}
          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors whitespace-nowrap"
        >
          ↓ Baixar CSV
        </button>
      </div>
      <p className="text-xs text-gray-400 mt-2">
        Sem filtro = exporta tudo. Abre direto no Excel ou importa no Google Sheets.
      </p>
    </div>
  )
}

// ─── Visão Geral ─────────────────────────────────────────────────────────────

function VisaoGeral() {
  const [dados, setDados] = useState<DadosPainel[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    fetch('/api/painel').then((r) => r.json()).then((d) => { setDados(d); setCarregando(false) })
  }, [])

  if (carregando) return <p className="text-center text-gray-400 py-12">Carregando...</p>

  return (
    <div>
    <ExportarCSV />
    <div className="grid gap-3 sm:grid-cols-2">
      {dados.map((d) => (
        <div key={d.estoque.codigo} className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="font-bold text-gray-900">{nomeEstoque(d.estoque)}</p>
              <p className="text-xs text-gray-400">Ciclo {d.ciclo.numero}</p>
            </div>
            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
              d.progresso === 100 ? 'bg-green-100 text-green-700' :
              d.progresso >= 50 ? 'bg-blue-100 text-blue-700' :
              'bg-gray-100 text-gray-600'
            }`}>
              {d.progresso}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5 mb-3">
            <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${d.progresso}%` }} />
          </div>
          <p className="text-xs text-gray-500">
            {d.contados}/{d.totalItens} itens contados
          </p>
          {d.ultimaContagem && (
            <p className="text-xs text-gray-400 mt-1 truncate">
              Último: {d.ultimaContagem.item.nome} · {d.ultimaContagem.contador}
            </p>
          )}
        </div>
      ))}
    </div>
    </div>
  )
}

// ─── Lista de Contagens ───────────────────────────────────────────────────────

function ListaContagens() {
  const [contagens, setContagens] = useState<Contagem[]>([])
  const [estoques, setEstoques] = useState<Estoque[]>([])
  const [filtroEstoque, setFiltroEstoque] = useState('')
  const [filtroData, setFiltroData] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [copiado, setCopiado] = useState(false)

  const carregar = useCallback(async () => {
    setCarregando(true)
    const params = new URLSearchParams()
    if (filtroEstoque) params.set('estoque', filtroEstoque)
    if (filtroData) params.set('data', filtroData)
    const [cRes, eRes] = await Promise.all([
      fetch(`/api/contagens?${params}`),
      fetch('/api/estoques'),
    ])
    setContagens(await cRes.json())
    setEstoques(await eRes.json())
    setCarregando(false)
  }, [filtroEstoque, filtroData])

  useEffect(() => { carregar() }, [carregar])

  // Agrupa por loja
  const porLoja = contagens.reduce<Record<string, Contagem[]>>((acc, c) => {
    const chave = c.estoqueCodigo
    if (!acc[chave]) acc[chave] = []
    acc[chave].push(c)
    return acc
  }, {})

  function gerarTexto() {
    return Object.entries(porLoja).map(([codigo, lista]) => {
      const e = estoques.find((x) => x.codigo === codigo)
      const cabecalho = `${nomeEstoque(e ?? { codigo, nome: null, tipo: 'loja' })}`
      const linhas = lista.map((c) =>
        `Produto: ${c.item.nome}\nSaldo = ${c.saldoContado}\nContado por: ${c.contador}`
      ).join('\n\n')
      return `${cabecalho}\n\n${linhas}`
    }).join('\n\n---\n\n')
  }

  function copiar() {
    navigator.clipboard.writeText(gerarTexto())
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        <select
          value={filtroEstoque}
          onChange={(e) => setFiltroEstoque(e.target.value)}
          className="flex-1 min-w-32 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="">Todos os estoques</option>
          {estoques.map((e) => (
            <option key={e.codigo} value={e.codigo}>{nomeEstoque(e)}</option>
          ))}
        </select>
        <input
          type="date"
          value={filtroData}
          onChange={(e) => setFiltroData(e.target.value)}
          className="flex-1 min-w-36 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
        />
        {contagens.length > 0 && (
          <button
            onClick={copiar}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              copiado ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {copiado ? '✓ Copiado' : 'Copiar tudo'}
          </button>
        )}
      </div>

      {carregando && <p className="text-center text-gray-400 py-8">Carregando...</p>}
      {!carregando && contagens.length === 0 && (
        <p className="text-center text-gray-400 py-8">Nenhuma contagem encontrada</p>
      )}

      {Object.entries(porLoja).map(([codigo, lista]) => {
        const e = estoques.find((x) => x.codigo === codigo)
        return (
          <div key={codigo} className="mb-6">
            <h3 className="font-bold text-gray-800 mb-2">
              {nomeEstoque(e ?? { codigo, nome: null, tipo: 'loja' })}
            </h3>
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
              {lista.map((c) => (
                <div key={c.id} className="px-4 py-3">
                  <p className="font-medium text-gray-900 text-sm">{c.item.nome}</p>
                  <p className="text-sm text-gray-600">Saldo = <strong>{c.saldoContado}</strong></p>
                  <p className="text-xs text-gray-400">Contado por: {c.contador} · {formatData(c.dataHora)}</p>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Conferência ─────────────────────────────────────────────────────────────

function Conferencia() {
  const [pendentes, setPendentes] = useState<Contagem[]>([])
  const [conferidos, setConferidos] = useState<Contagem[]>([])
  const [carregando, setCarregando] = useState(true)
  const [abaConf, setAbaConf] = useState<'pendentes' | 'conferidos'>('pendentes')

  const carregar = useCallback(async () => {
    const [pRes, cRes] = await Promise.all([
      fetch('/api/contagens?status=pendente_conferencia'),
      fetch('/api/contagens?status=conferido'),
    ])
    setPendentes(await pRes.json())
    setConferidos(await cRes.json())
    setCarregando(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const totalDivergencia = conferidos.reduce((s, c) => s + (c.valorDivergencia ?? 0), 0)

  if (carregando) return <p className="text-center text-gray-400 py-8">Carregando...</p>

  return (
    <div>
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-amber-700">{pendentes.length}</p>
          <p className="text-xs text-amber-600">Pendentes</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-green-700">{conferidos.length}</p>
          <p className="text-xs text-green-600">Conferidos</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-red-700">{formatMoeda(totalDivergencia)}</p>
          <p className="text-xs text-red-600">Divergência</p>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setAbaConf('pendentes')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            abaConf === 'pendentes' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
          }`}
        >
          Pendentes ({pendentes.length})
        </button>
        <button
          onClick={() => setAbaConf('conferidos')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            abaConf === 'conferidos' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
          }`}
        >
          Conferidos ({conferidos.length})
        </button>
      </div>

      {abaConf === 'pendentes' && (
        <div className="space-y-3">
          {pendentes.length === 0 && (
            <p className="text-center text-gray-400 py-8">Nenhuma contagem pendente</p>
          )}
          {pendentes.map((c) => (
            <ItemPendente key={c.id} contagem={c} onConferido={carregar} />
          ))}
        </div>
      )}

      {abaConf === 'conferidos' && (
        <div className="space-y-2">
          {conferidos.length === 0 && (
            <p className="text-center text-gray-400 py-8">Nenhuma contagem conferida</p>
          )}
          {conferidos.map((c) => (
            <div
              key={c.id}
              className={`bg-white rounded-xl border p-4 ${
                (c.divergencia ?? 0) !== 0 ? 'border-red-200' : 'border-gray-200'
              }`}
            >
              <p className="font-semibold text-gray-900 text-sm">{c.item.nome}</p>
              <p className="text-xs text-gray-400">{nomeEstoque(c.estoque)} · {c.contador} · {formatData(c.dataHora)}</p>
              <div className="flex gap-4 mt-2 text-sm">
                <span className="text-gray-600">Contado: <strong>{c.saldoContado}</strong></span>
                <span className="text-gray-600">Sistema: <strong>{c.saldoSistema}</strong></span>
                <span className={`font-semibold ${(c.divergencia ?? 0) !== 0 ? 'text-red-600' : 'text-green-600'}`}>
                  Dif: {c.divergencia ?? 0} ({formatMoeda(c.valorDivergencia ?? 0)})
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ItemPendente({ contagem, onConferido }: { contagem: Contagem; onConferido: () => void }) {
  const [saldoSistema, setSaldoSistema] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    if (!saldoSistema) return
    setSalvando(true)
    await fetch(`/api/contagens/${contagem.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ saldoSistema: parseInt(saldoSistema) }),
    })
    onConferido()
    setSalvando(false)
  }

  return (
    <div className="bg-white rounded-xl border border-amber-200 p-4">
      <p className="font-semibold text-gray-900 text-sm">{contagem.item.nome}</p>
      <p className="text-xs text-gray-400 mb-1">{nomeEstoque(contagem.estoque)} · {contagem.contador} · {formatData(contagem.dataHora)}</p>
      <p className="text-sm text-gray-700 mb-3">Saldo contado: <strong>{contagem.saldoContado}</strong></p>
      <div className="flex gap-2">
        <input
          type="number"
          inputMode="numeric"
          value={saldoSistema}
          onChange={(e) => setSaldoSistema(e.target.value)}
          placeholder="Saldo do sistema"
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
        />
        <button
          onClick={salvar}
          disabled={!saldoSistema || salvando}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-blue-700 transition-colors"
        >
          {salvando ? '...' : 'Conferir'}
        </button>
      </div>
    </div>
  )
}

// ─── Cadastro de Produtos ─────────────────────────────────────────────────────

type RespostaItens = { itens: Item[]; total: number; pagina: number; totalPaginas: number }

function CadastroProdutos() {
  const [itens, setItens] = useState<Item[]>([])
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [totalPaginas, setTotalPaginas] = useState(1)
  const [busca, setBusca] = useState('')
  const [resultadosBusca, setResultadosBusca] = useState<Item[]>([])
  const [carregando, setCarregando] = useState(true)
  const [modo, setModo] = useState<'lista' | 'novo' | 'editar'>('lista')
  const [itemEditando, setItemEditando] = useState<Item | null>(null)
  const [form, setForm] = useState({ sku: '', nome: '', categoria: '', precoCusto: '' })
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async (p = 1) => {
    setCarregando(true)
    const res = await fetch(`/api/itens?pagina=${p}`)
    const data: RespostaItens = await res.json()
    setItens(data.itens)
    setTotal(data.total)
    setPagina(data.pagina)
    setTotalPaginas(data.totalPaginas)
    setCarregando(false)
  }, [])

  useEffect(() => { carregar(1) }, [carregar])

  useEffect(() => {
    if (busca.length < 2) { setResultadosBusca([]); return }
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/itens?busca=${encodeURIComponent(busca)}`)
      const data: RespostaItens | Item[] = await res.json()
      setResultadosBusca(Array.isArray(data) ? data : data.itens)
    }, 300)
    return () => clearTimeout(timer)
  }, [busca])

  function abrirNovo() {
    setForm({ sku: '', nome: '', categoria: '', precoCusto: '' })
    setErro('')
    setItemEditando(null)
    setModo('novo')
  }

  function abrirEditar(item: Item) {
    setForm({ sku: item.sku, nome: item.nome, categoria: item.categoria, precoCusto: String(item.precoCusto) })
    setErro('')
    setItemEditando(item)
    setModo('editar')
  }

  async function salvar() {
    if (!form.sku || !form.nome || !form.categoria || !form.precoCusto) {
      setErro('Preencha todos os campos')
      return
    }
    setSalvando(true)
    setErro('')
    try {
      let res: Response
      if (modo === 'novo') {
        res = await fetch('/api/itens', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, precoCusto: parseFloat(form.precoCusto) }),
        })
      } else {
        res = await fetch(`/api/itens/${encodeURIComponent(itemEditando!.sku)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome: form.nome, categoria: form.categoria, precoCusto: parseFloat(form.precoCusto) }),
        })
      }
      if (!res.ok) {
        const err = await res.json()
        setErro(err.error ?? 'Erro ao salvar')
        return
      }
      await carregar(pagina)
      setModo('lista')
    } finally {
      setSalvando(false)
    }
  }

  async function excluir(sku: string) {
    if (!confirm(`Excluir o produto "${sku}"?`)) return
    await fetch(`/api/itens/${encodeURIComponent(sku)}`, { method: 'DELETE' })
    await carregar(pagina)
  }

  const listaExibida = busca.length >= 2 ? resultadosBusca : itens

  if (modo === 'novo' || modo === 'editar') {
    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setModo('lista')} className="text-gray-400 hover:text-gray-600 text-xl">←</button>
          <h2 className="text-lg font-bold text-gray-900">
            {modo === 'novo' ? 'Novo Produto' : 'Editar Produto'}
          </h2>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">SKU *</label>
            <input
              type="text"
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              disabled={modo === 'editar'}
              placeholder="Ex: ACRIL-BR-18L"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:border-blue-400 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
            <input
              type="text"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Ex: Acrílico Branco SB 18L"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:border-blue-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoria *</label>
            <input
              type="text"
              value={form.categoria}
              onChange={(e) => setForm({ ...form, categoria: e.target.value })}
              placeholder="Ex: Tintas Acrílicas"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:border-blue-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Preço de Custo (R$) *</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={form.precoCusto}
              onChange={(e) => setForm({ ...form, precoCusto: e.target.value })}
              placeholder="0.00"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:border-blue-400 focus:outline-none"
            />
          </div>
          {erro && <p className="text-red-600 text-sm">{erro}</p>}
          <button
            onClick={salvar}
            disabled={salvando}
            className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl disabled:opacity-40 hover:bg-blue-700 transition-colors"
          >
            {salvando ? 'Salvando...' : modo === 'novo' ? 'Cadastrar Produto' : 'Salvar Alterações'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{total} produto(s)</p>
        <button
          onClick={abrirNovo}
          className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
        >
          + Novo Produto
        </button>
      </div>

      <input
        type="text"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por nome, SKU ou categoria..."
        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:border-blue-400 focus:outline-none mb-4"
      />

      {carregando && <p className="text-center text-gray-400 py-8">Carregando...</p>}
      {!carregando && listaExibida.length === 0 && (
        <p className="text-center text-gray-400 py-8">
          {total === 0 ? 'Nenhum produto cadastrado ainda' : 'Nenhum produto encontrado'}
        </p>
      )}

      <div className="space-y-2">
        {listaExibida.map((item) => (
          <div key={item.sku} className="bg-white rounded-xl border border-gray-200 p-4 flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 text-sm truncate">{item.nome}</p>
              <p className="text-xs text-gray-400 mt-0.5">{item.sku} · {item.categoria}</p>
              <p className="text-xs text-gray-500 mt-0.5">Custo: {formatMoeda(item.precoCusto)}</p>
            </div>
            <div className="flex gap-1 shrink-0">
              <button
                onClick={() => abrirEditar(item)}
                className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Editar
              </button>
              <button
                onClick={() => excluir(item.sku)}
                className="px-3 py-1.5 text-xs bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
              >
                Excluir
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Paginação */}
      {!busca && totalPaginas > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => carregar(pagina - 1)}
            disabled={pagina === 1 || carregando}
            className="px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            ← Anterior
          </button>
          <span className="text-sm text-gray-500">
            Página {pagina} de {totalPaginas}
          </span>
          <button
            onClick={() => carregar(pagina + 1)}
            disabled={pagina === totalPaginas || carregando}
            className="px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            Próxima →
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function PainelPage() {
  const [tab, setTab] = useState<Tab>('visao-geral')
  const router = useRouter()

  useEffect(() => {
    const p = localStorage.getItem('persona')
    if (!p || p !== 'Gestor') {
      router.push('/')
    }
  }, [router])

  const tabs: { key: Tab; label: string }[] = [
    { key: 'visao-geral', label: 'Visão Geral' },
    { key: 'lista', label: 'Lista' },
    { key: 'conferencia', label: 'Conferência' },
    { key: 'produtos', label: 'Produtos' },
  ]

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center justify-between pt-4 pb-2">
            <h1 className="text-xl font-bold text-gray-900">Painel do Gestor</h1>
            <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">Sair</Link>
          </div>
          <div className="flex overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  tab === t.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {tab === 'visao-geral' && <VisaoGeral />}
        {tab === 'lista' && <ListaContagens />}
        {tab === 'conferencia' && <Conferencia />}
        {tab === 'produtos' && <CadastroProdutos />}
      </div>
    </main>
  )
}
