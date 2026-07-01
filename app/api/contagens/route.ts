import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { registrarContagem } from '@/lib/ciclo'

export async function GET(request: NextRequest) {
  const estoque = request.nextUrl.searchParams.get('estoque')
  const status = request.nextUrl.searchParams.get('status')
  const data = request.nextUrl.searchParams.get('data')

  const where: Record<string, unknown> = {}
  if (estoque) where.estoqueCodigo = estoque
  if (status) where.status = status
  if (data) {
    const inicio = new Date(data)
    const fim = new Date(data)
    fim.setDate(fim.getDate() + 1)
    where.dataHora = { gte: inicio, lt: fim }
  }

  const contagens = await prisma.contagem.findMany({
    where,
    include: { item: true, estoque: true },
    orderBy: { dataHora: 'desc' },
    take: 200,
  })
  return NextResponse.json(contagens)
}

export async function POST(request: Request) {
  const { estoqueCodigo, sku, contador, saldoContado } = await request.json()

  if (!estoqueCodigo || !sku || !contador || saldoContado === undefined) {
    return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 })
  }

  const resultado = await registrarContagem({
    estoqueCodigo,
    sku,
    contador,
    saldoContado: parseInt(saldoContado),
  })

  return NextResponse.json(resultado, { status: 201 })
}
