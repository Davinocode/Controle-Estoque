import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const estoques = await prisma.estoque.findMany({ orderBy: { codigo: 'asc' } })
  return NextResponse.json(estoques)
}

export async function PATCH(request: Request) {
  const { codigo, nome } = await request.json()
  const estoque = await prisma.estoque.update({
    where: { codigo },
    data: { nome },
  })
  return NextResponse.json(estoque)
}
