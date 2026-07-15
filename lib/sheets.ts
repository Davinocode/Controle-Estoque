import { JWT } from 'google-auth-library'

// Integração que ALIMENTA a planilha do Google Sheets (a mesma que o Dashboard de
// Auditoria de Estoque lê). Cada conferência vira uma linha na aba de contagens,
// no mesmo formato de colunas do dashboard. Só ACRESCENTA linhas — nunca sobrescreve.

type ContagemParaPlanilha = {
  dataHora: Date | string
  estoque: { codigo: string; nome: string | null; tipo: string }
  item: { nome: string; precoCusto: number }
  contador: string
  saldoContado: number
  saldoSistema: number | null
  divergencia: number | null
}

// Serial de data do Google Sheets (dias desde 1899-12-30), somente data, fuso de SP.
// Mantém o mesmo formato numérico das linhas já existentes na planilha.
function serialDeData(d: Date): number {
  const iso = d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) // yyyy-mm-dd
  const [y, m, dia] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, dia) / 86400000 + 25569
}

function statusPlanilha(divergencia: number): string {
  if (divergencia > 0) return 'Sobrou'
  if (divergencia < 0) return 'Faltou'
  return 'OK'
}

function nomeLoja(estoque: ContagemParaPlanilha['estoque']): string {
  if (estoque.nome) return estoque.nome
  return estoque.tipo === 'cd' ? `CD ${estoque.codigo}` : `Loja ${estoque.codigo}`
}

let clienteJWT: JWT | null = null
function getClienteJWT(): JWT {
  if (clienteJWT) return clienteJWT
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON não configurado')
  const creds = JSON.parse(raw)
  clienteJWT = new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
  return clienteJWT
}

/**
 * Acrescenta uma linha na planilha para uma contagem conferida.
 * Ordem das colunas (A:I), igual à planilha lida pelo dashboard:
 * Data | Loja | Produto | Qtd_Estoque_Sistema | Qtd_Encontrada_Fisico |
 * Diferenca | Status | Responsável pelo Balanço | Valor Unitário (R$)
 */
export async function appendContagemNaPlanilha(c: ContagemParaPlanilha): Promise<void> {
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID
  const aba = process.env.GOOGLE_SHEET_NAME || 'Contagens'
  if (!spreadsheetId) throw new Error('GOOGLE_SPREADSHEET_ID não configurado')

  const divergencia = c.divergencia ?? 0
  const linha: (string | number)[] = [
    serialDeData(new Date(c.dataHora)),
    nomeLoja(c.estoque),
    c.item.nome,
    c.saldoSistema ?? '',
    c.saldoContado,
    divergencia,
    statusPlanilha(divergencia),
    c.contador,
    c.item.precoCusto,
  ]

  const client = getClienteJWT()
  const { token } = await client.getAccessToken()
  const range = encodeURIComponent(`${aba}!A:I`)
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append` +
    `?valueInputOption=RAW&insertDataOption=INSERT_ROWS`

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [linha] }),
  })

  if (!res.ok) {
    const detalhe = await res.text()
    throw new Error(`Falha ao gravar na planilha (${res.status}): ${detalhe}`)
  }
}
