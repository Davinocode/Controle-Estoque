import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  const busca = request.nextUrl.searchParams.get('busca')

  if (busca) {
    const itens = await prisma.item.findMany({
      where: {
        OR: [
          { nome: { contains: busca } },
          { sku: { contains: busca } },
          { categoria: { contains: busca } },
        ],
      },
      orderBy: { nome: 'asc' },
      take: 20,
    })
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
