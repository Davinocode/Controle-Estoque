import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCicloAtivo } from '@/lib/ciclo'

export async function GET() {
  const [estoques, totalItens] = await Promise.all([
    prisma.estoque.findMany({ orderBy: { codigo: 'asc' } }),
    prisma.item.count(),
  ])

  const dados = await Promise.all(
    estoques.map(async (e) => {
      const ciclo = await getCicloAtivo(e.codigo)
      const [contados, ultimaContagem] = await Promise.all([
        prisma.itemContadoNoCiclo.count({ where: { cicloId: ciclo.id } }),
        prisma.contagem.findFirst({
          where: { estoqueCodigo: e.codigo },
          orderBy: { dataHora: 'desc' },
          include: { item: true },
        }),
      ])
      return {
        estoque: e,
        ciclo,
        totalItens,
        contados,
        progresso: totalItens > 0 ? Math.round((contados / totalItens) * 100) : 0,
        ultimaContagem,
      }
    })
  )

  return NextResponse.json(dados)
}
