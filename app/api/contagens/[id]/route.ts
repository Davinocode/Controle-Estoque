import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { appendContagemNaPlanilha } from '@/lib/sheets'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const contagemId = parseInt(id)
  const body = await request.json()

  const contagem = await prisma.contagem.findUnique({
    where: { id: contagemId },
    include: { item: true },
  })
  if (!contagem) {
    return NextResponse.json({ error: 'Contagem não encontrada' }, { status: 404 })
  }

  // ── Correção do saldo contado (uso do gestor, pelo painel) ───────────────────
  // Quando alguém conta a quantidade errada e sobe no app, o gestor pode corrigir.
  // A planilha do Google é append-only e só recebe a linha na conferência; por isso
  // só permitimos corrigir enquanto a contagem ainda está PENDENTE — depois de
  // conferida, a linha já foi para a planilha/dashboard e uma edição criaria
  // duplicidade. Cada correção é registrada em EdicaoContagem (auditoria).
  if (body.saldoContado !== undefined) {
    const novo = parseInt(body.saldoContado)
    if (Number.isNaN(novo) || novo < 0) {
      return NextResponse.json({ error: 'Saldo contado inválido' }, { status: 400 })
    }
    if (contagem.status === 'conferido') {
      return NextResponse.json(
        { error: 'Esta contagem já foi conferida e enviada à planilha; não pode ser editada.' },
        { status: 409 },
      )
    }

    // Sem mudança de valor: devolve como está, sem registrar edição.
    if (novo === contagem.saldoContado) {
      const atual = await prisma.contagem.findUnique({
        where: { id: contagemId },
        include: { item: true, estoque: true, edicoes: { orderBy: { editadoEm: 'asc' } } },
      })
      return NextResponse.json(atual)
    }

    const editadoPor =
      typeof body.editadoPor === 'string' && body.editadoPor.trim() ? body.editadoPor.trim() : 'Gestor'
    const motivo = typeof body.motivo === 'string' && body.motivo.trim() ? body.motivo.trim() : null

    const [, atualizada] = await prisma.$transaction([
      prisma.edicaoContagem.create({
        data: {
          contagemId,
          saldoAntigo: contagem.saldoContado,
          saldoNovo: novo,
          editadoPor,
          motivo,
        },
      }),
      prisma.contagem.update({
        where: { id: contagemId },
        data: { saldoContado: novo },
        include: { item: true, estoque: true, edicoes: { orderBy: { editadoEm: 'asc' } } },
      }),
    ])

    return NextResponse.json(atualizada)
  }

  // ── Conferência (fluxo existente): grava saldoSistema e alimenta a planilha ───
  const { saldoSistema } = body
  if (saldoSistema === undefined || saldoSistema === null) {
    return NextResponse.json({ error: 'saldoSistema é obrigatório' }, { status: 400 })
  }

  const divergencia = contagem.saldoContado - saldoSistema
  const valorDivergencia = divergencia * contagem.item.precoCusto

  const atualizada = await prisma.contagem.update({
    where: { id: contagemId },
    data: {
      saldoSistema,
      divergencia,
      valorDivergencia,
      status: 'conferido',
    },
    include: { item: true, estoque: true },
  })

  // Alimenta a planilha do Google Sheets (fluxo: conferência -> planilha -> dashboard).
  // Não-bloqueante: se a planilha falhar, a conferência não se perde; sinaliza no retorno.
  let planilhaSincronizada = true
  let planilhaErro: string | undefined
  try {
    await appendContagemNaPlanilha(atualizada)
  } catch (e) {
    planilhaSincronizada = false
    planilhaErro = e instanceof Error ? e.message : String(e)
    console.error('[sheets] falha ao alimentar a planilha:', planilhaErro)
  }

  return NextResponse.json({ ...atualizada, planilhaSincronizada, planilhaErro })
}
