import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { senha } = await request.json()
  const senhaCorreta = process.env.GESTOR_SENHA

  if (!senhaCorreta) {
    return NextResponse.json({ error: 'Senha não configurada no servidor' }, { status: 500 })
  }

  if (senha !== senhaCorreta) {
    return NextResponse.json({ error: 'Senha incorreta' }, { status: 401 })
  }

  return NextResponse.json({ ok: true })
}
