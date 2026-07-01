import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  const estoque = request.nextUrl.searchParams.get('estoque')
  const dataInicio = request.nextUrl.searchParams.get('de')
  const dataFim = request.nextUrl.searchParams.get('ate')

  const where: Record<string, unknown> = {}
  if (estoque) where.estoqueCodigo = estoque
  if (dataInicio || dataFim) {
    where.dataHora = {
      ...(dataInicio ? { gte: new Date(dataInicio) } : {}),
      ...(dataFim ? { lte: new Date(dataFim + 'T23:59:59') } : {}),
    }
  }

  const contagens = await prisma.contagem.findMany({
    where,
    include: { item: true, estoque: true },
    orderBy: [{ estoqueCodigo: 'asc' }, { dataHora: 'desc' }],
  })

  const cabecalho = [
    'Data',
    'Hora',
    'Loja',
    'Ciclo',
    'SKU',
    'Produto',
    'Categoria',
    'Contador',
    'Saldo Contado',
    'Saldo Sistema',
    'Divergência',
    'Valor Divergência (R$)',
    'Status',
  ]

  function nomeLoja(c: (typeof contagens)[0]) {
    if (c.estoque.nome) return c.estoque.nome
    return c.estoque.tipo === 'cd' ? `CD ${c.estoque.codigo}` : `Loja ${c.estoque.codigo}`
  }

  function csvCell(v: unknown) {
    const s = String(v ?? '')
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }

  const linhas = contagens.map((c) => {
    const dt = new Date(c.dataHora)
    return [
      dt.toLocaleDateString('pt-BR'),
      dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      nomeLoja(c),
      c.numeroCiclo,
      c.sku,
      c.item.nome,
      c.item.categoria,
      c.contador,
      c.saldoContado,
      c.saldoSistema ?? '',
      c.divergencia ?? '',
      c.valorDivergencia != null ? c.valorDivergencia.toFixed(2).replace('.', ',') : '',
      c.status === 'conferido' ? 'Conferido' : 'Pendente',
    ].map(csvCell).join(',')
  })

  const csv = [cabecalho.join(','), ...linhas].join('\r\n')

  return new NextResponse('﻿' + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="contagens_${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
