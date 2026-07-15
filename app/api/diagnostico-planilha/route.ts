import { NextRequest, NextResponse } from 'next/server'
import { JWT } from 'google-auth-library'
import { appendContagemNaPlanilha } from '@/lib/sheets'

// Diagnóstico da integração com a planilha.
//  GET                         -> somente leitura (tipo do arquivo, permissão, colunas)
//  GET ?acao=teste-escrita     -> grava uma linha marcada via lib/sheets, lê de volta e apaga (self-cleaning)
// (endpoint temporário de verificação — pode ser removido depois)

const MARCADOR = '__DIAGNOSTICO__'

function jwt(creds: { client_email: string; private_key: string }) {
  return new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'],
  })
}

export async function GET(request: NextRequest) {
  try {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID
    const aba = process.env.GOOGLE_SHEET_NAME || 'Contagens'
    if (!raw) return NextResponse.json({ ok: false, etapa: 'env', erro: 'GOOGLE_SERVICE_ACCOUNT_JSON ausente' })
    if (!spreadsheetId) return NextResponse.json({ ok: false, etapa: 'env', erro: 'GOOGLE_SPREADSHEET_ID ausente' })

    let creds: { client_email: string; private_key: string }
    try { creds = JSON.parse(raw) } catch {
      return NextResponse.json({ ok: false, etapa: 'parse', erro: 'credencial não é JSON (referência não resolveu?)', amostra: raw.slice(0, 30) })
    }

    const { token } = await jwt(creds).getAccessToken()
    if (!token) return NextResponse.json({ ok: false, etapa: 'auth', erro: 'não obteve token' })
    const H = { Authorization: `Bearer ${token}` }

    // Drive: tipo do arquivo + permissão de edição
    const driveRes = await fetch(`https://www.googleapis.com/drive/v3/files/${spreadsheetId}?fields=name,mimeType,capabilities(canEdit)&supportsAllDrives=true`, { headers: H })
    const drive = await driveRes.json()
    const ehNativa = drive?.mimeType === 'application/vnd.google-apps.spreadsheet'
    const podeEditar = drive?.capabilities?.canEdit === true

    // Sheets: colunas do cabeçalho (só funciona em planilha nativa)
    const range = encodeURIComponent(`${aba}!A1:M1`)
    const sheetsRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`, { headers: H })
    const sheetsBody = await sheetsRes.json()

    // Abas + gids (útil pra apontar o dashboard, que usa gid)
    const metaAbas = await (await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties(title,sheetId)`, { headers: H })).json()
    const abas = (metaAbas.sheets || []).map((s: { properties: { title: string; sheetId: number } }) => ({ titulo: s.properties.title, gid: s.properties.sheetId }))

    const base = {
      serviceAccount: creds.client_email,
      drive: driveRes.ok ? { nome: drive.name, ehPlanilhaNativa: ehNativa, podeEditar } : { erro: drive?.error?.message },
      sheets: sheetsRes.ok ? { aba, colunas: sheetsBody.values?.[0] ?? [] } : { aba, status: sheetsRes.status, erro: sheetsBody?.error?.message },
      abas,
    }

    if (request.nextUrl.searchParams.get('acao') !== 'teste-escrita') {
      return NextResponse.json({ ok: driveRes.ok && sheetsRes.ok, ...base })
    }

    // ---- teste de escrita self-cleaning ----
    if (!ehNativa || !podeEditar) {
      return NextResponse.json({ ok: false, ...base, teste: 'abortado: planilha não é nativa ou service account sem permissão de edição' })
    }

    // 1) grava via a MESMA função de produção (lib/sheets)
    await appendContagemNaPlanilha({
      dataHora: new Date(),
      estoque: { codigo: '000', nome: MARCADOR, tipo: 'loja' },
      item: { nome: 'TESTE DIAGNOSTICO', precoCusto: 1.23 },
      contador: 'DIAGNOSTICO',
      saldoContado: 8,
      saldoSistema: 5,
      divergencia: 3,
    })

    // 2) acha as linhas marcadas (coluna B = Loja) e lê a última pra mostrar o formato
    const colB = await (await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`${aba}!B1:B100000`)}`, { headers: H })).json()
    const linhasMarcadas: number[] = []
    ;(colB.values || []).forEach((r: string[], i: number) => { if (r[0] === MARCADOR) linhasMarcadas.push(i + 1) })

    let linhaGravada: unknown = null
    if (linhasMarcadas.length) {
      const ultima = linhasMarcadas[linhasMarcadas.length - 1]
      const lida = await (await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`${aba}!A${ultima}:I${ultima}`)}?valueRenderOption=UNFORMATTED_VALUE`, { headers: H })).json()
      linhaGravada = lida.values?.[0] ?? null
    }

    // 3) descobre o sheetId da aba e apaga TODAS as linhas marcadas (de baixo pra cima)
    const meta = await (await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`, { headers: H })).json()
    const tab = meta.sheets?.map((s: { properties: { title: string; sheetId: number } }) => s.properties).find((p: { title: string }) => p.title === aba)
    let apagadas = 0
    if (tab && linhasMarcadas.length) {
      const requests = [...linhasMarcadas].sort((a, b) => b - a).map((rowNum) => ({
        deleteDimension: { range: { sheetId: tab.sheetId, dimension: 'ROWS', startIndex: rowNum - 1, endIndex: rowNum } },
      }))
      const del = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ requests }),
      })
      if (del.ok) apagadas = requests.length
      else return NextResponse.json({ ok: false, ...base, teste: 'append OK, mas exclusão falhou', detalhe: await del.text(), linhasMarcadas })
    }

    return NextResponse.json({
      ok: true,
      ...base,
      teste: 'escrita ponta a ponta OK (append via lib/sheets + leitura + limpeza)',
      linhaGravada,
      linhasDeTesteApagadas: apagadas,
    })
  } catch (e) {
    return NextResponse.json({ ok: false, etapa: 'excecao', erro: e instanceof Error ? e.message : String(e) })
  }
}
