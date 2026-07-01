import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { saldoSistema } = await request.json()

  const contagem = await prisma.contagem.findUnique({
    where: { id: parseInt(id) },
    include: { item: true },
  })
  if (!contagem) {
    return NextResponse.json({ error: 'Contagem não encontrada' }, { status: 404 })
  }

  const divergencia = contagem.saldoContado - saldoSistema
  const valorDivergencia = divergencia * contagem.item.precoCusto

  const atualizada = await prisma.contagem.update({
    where: { id: parseInt(id) },
    data: {
      saldoSistema,
      divergencia,
      valorDivergencia,
      status: 'conferido',
    },
    include: { item: true, estoque: true },
  })
  return NextResponse.json(atualizada)
}
