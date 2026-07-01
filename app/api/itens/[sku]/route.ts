import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ sku: string }> }) {
  const { sku } = await params
  const { nome, categoria, precoCusto } = await request.json()

  const item = await prisma.item.update({
    where: { sku },
    data: { nome, categoria, precoCusto: parseFloat(precoCusto) },
  })
  return NextResponse.json(item)
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ sku: string }> }) {
  const { sku } = await params

  await prisma.item.delete({ where: { sku } })
  return NextResponse.json({ ok: true })
}
