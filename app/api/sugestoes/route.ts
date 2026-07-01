import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCicloAtivo, getSugestoes } from '@/lib/ciclo'

export async function GET(request: NextRequest) {
  const estoqueCodigo = request.nextUrl.searchParams.get('estoque')
  if (!estoqueCodigo) {
    return NextResponse.json({ error: 'estoque obrigatório' }, { status: 400 })
  }

  const ciclo = await getCicloAtivo(estoqueCodigo)
  const { sugestoes } = await getSugestoes(estoqueCodigo)

  const [totalItens, contados, estoqueData] = await Promise.all([
    prisma.item.count(),
    prisma.itemContadoNoCiclo.count({ where: { cicloId: ciclo.id } }),
    prisma.estoque.findUnique({ where: { codigo: estoqueCodigo } }),
  ])

  return NextResponse.json({ ciclo, sugestoes, totalItens, contados, estoque: estoqueData })
}
