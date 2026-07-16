import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  const busca = request.nextUrl.searchParams.get('busca')

  if (busca && busca.trim()) {
    // Busca tolerante: ignora maiúsculas/minúsculas (ILIKE), ignora acentos
    // (unaccent) e aceita várias palavras em qualquer ordem — cada palavra
    // digitada precisa aparecer em nome, SKU ou categoria.
    // Ex.: "osmocolor montana" acha "OSMOCOLOR NATURAL UV GOLD 3,6LT MONTANA";
    //      "acrilico" acha tanto "ACRILICO" quanto "ACRÍLICO".
    const tokens = busca.trim().split(/\s+/).slice(0, 6)
    const condicoes = tokens.map((t) => {
      const like = `%${t}%`
      return Prisma.sql`(unaccent("nome") ILIKE unaccent(${like}) OR unaccent("sku") ILIKE unaccent(${like}) OR unaccent("categoria") ILIKE unaccent(${like}))`
    })
    const where = Prisma.join(condicoes, ' AND ')
    const itens = await prisma.$queryRaw<
      { sku: string; nome: string; categoria: string; precoCusto: number }[]
    >(Prisma.sql`
      SELECT "sku", "nome", "categoria", "precoCusto"
      FROM "Item"
      WHERE ${where}
      ORDER BY "nome" ASC
      LIMIT 30
    `)
    return NextResponse.json(itens)
  }

  const pagina = parseInt(request.nextUrl.searchParams.get('pagina') ?? '1')
  const porPagina = 50
  const [itens, total] = await Promise.all([
    prisma.item.findMany({
      orderBy: { sku: 'asc' },
      skip: (pagina - 1) * porPagina,
      take: porPagina,
    }),
    prisma.item.count(),
  ])
  return NextResponse.json({ itens, total, pagina, totalPaginas: Math.ceil(total / porPagina) })
}

export async function POST(request: Request) {
  const { sku, nome, categoria, precoCusto } = await request.json()

  if (!sku || !nome || !categoria || precoCusto === undefined) {
    return NextResponse.json({ error: 'Campos obrigatórios: sku, nome, categoria, precoCusto' }, { status: 400 })
  }

  const existente = await prisma.item.findUnique({ where: { sku } })
  if (existente) {
    return NextResponse.json({ error: 'SKU já cadastrado' }, { status: 409 })
  }

  const item = await prisma.item.create({
    data: { sku, nome, categoria, precoCusto: parseFloat(precoCusto) },
  })
  return NextResponse.json(item, { status: 201 })
}
