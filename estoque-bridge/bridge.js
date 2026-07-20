// estoque-bridge — roda no Railway como CRON (*/5 min).
// Lê as contagens brutas da planilha do app (native Google Sheet), normaliza lojas,
// recalcula Valor da Divergência e o resumo por loja, gera .xlsx e sobrescreve o
// arquivo que o dashboard lê. É o mesmo bridge validado manualmente, agora automático.
//
// Variáveis de ambiente (definidas no serviço Railway, credenciais por REFERÊNCIA):
//   GOOGLE_SERVICE_ACCOUNT_JSON  -> ${{controle-estoque.GOOGLE_SERVICE_ACCOUNT_JSON}}
//   GOOGLE_SPREADSHEET_ID        -> ${{controle-estoque.GOOGLE_SPREADSHEET_ID}}  (SOURCE, native)
//   DEST_FILE_ID                 -> 1s64... (arquivo .xlsx lido pelo dashboard)
const { JWT } = require('google-auth-library');
const ExcelJS = require('exceljs');

const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GSA_JSON);
const SOURCE = process.env.GOOGLE_SPREADSHEET_ID || process.env.SOURCE_ID;
const DEST = process.env.DEST_FILE_ID || process.env.DEST_ID;
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const stripAccents = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '');
const norm = s => stripAccents(s).toUpperCase().trim().replace(/\s+/g, ' ');
function canonLoja(v) {
  const map = { 'CRSITAL': 'Cristal', 'CRISTAL': 'Cristal', 'EDGAR': 'Edgar', 'MOINHOS': 'Moinhos', 'OSORIO': 'Osório', 'VIAMAO': 'Viamão', 'SAO LEOPOLDO': 'São Leopoldo', 'CAPAO DA CANOA': 'Capão da Canoa', 'NOVO HAMBURDO': 'Novo Hamburgo', 'NOVO HAMBURGO': 'Novo Hamburgo', 'SANTO ANTONIO CD': 'Santo Antônio CD', 'CD CENTRAL': 'Santo Antônio CD', 'SANTO ANTONIO': 'SAP', 'SAP': 'SAP' };
  return map[norm(v)] || String(v).trim();
}
function money(v) { if (v == null || v === '') return 0; if (typeof v === 'number') return v; let s = String(v).replace(/[R$\s]/g, ''); if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.'); return parseFloat(s) || 0; }
function intn(v) { if (v == null || v === '') return 0; if (typeof v === 'number') return Math.round(v); const n = parseInt(String(v).replace(/[^\d-]/g, '')); return isNaN(n) ? 0 : n; }
// Normaliza data: serial do Google Sheets (nº) -> DD/MM/AAAA; já-string -> inalterada.
function toBR(v) { if (v instanceof Date) return `${String(v.getUTCDate()).padStart(2,'0')}/${String(v.getUTCMonth()+1).padStart(2,'0')}/${v.getUTCFullYear()}`; const s = String(v == null ? '' : v).trim(); if (/^\d+$/.test(s)) { const n = parseInt(s); if (n > 10000 && n < 70000) { const d = new Date(Date.UTC(1899,11,30)+n*86400000); return `${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}/${d.getUTCFullYear()}`; } } return s; }
const r2 = x => Math.round(x * 100) / 100;
async function token() { const jwt = new JWT({ email: creds.client_email, key: creds.private_key, scopes: ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/spreadsheets'] }); return (await jwt.getAccessToken()).token; }

(async () => {
  if (!creds || !SOURCE || !DEST) throw new Error('faltando env: GOOGLE_SERVICE_ACCOUNT_JSON / GOOGLE_SPREADSHEET_ID / DEST_FILE_ID');
  const tk = await token();
  const data = await (await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SOURCE}/values/${encodeURIComponent('Contagens!A1:Z100000')}`, { headers: { Authorization: `Bearer ${tk}` } })).json();
  const vals = data.values || []; const H = vals[0] || [];
  const idx = name => H.findIndex(h => String(h).trim().toLowerCase() === name.toLowerCase());
  const iData = idx('Data'), iLoja = idx('Loja'), iProd = idx('Produto'), iQS = idx('Qtd_Estoque_Sistema'), iQF = idx('Qtd_Encontrada_Fisico'), iDif = idx('Diferenca'), iSt = idx('Status'), iResp = idx('Responsável pelo Balanço'), iVU = idx('Valor Unitário (R$)');
  const body = vals.slice(1).filter(r => String(r[iLoja] || '').trim() && String(r[iProd] || '').trim());
  const rows = body.map(r => { const dif = intn(r[iDif]); const vu = money(r[iVU]); return { Data: toBR(r[iData]), Loja: canonLoja(r[iLoja]), Produto: String(r[iProd]).trim(), QS: intn(r[iQS]), QF: intn(r[iQF]), Dif: dif, Status: String(r[iSt] || '').trim(), Resp: String(r[iResp] || '').trim(), VU: vu, VD: dif * vu }; });

  const agg = {};
  for (const r of rows) { const a = agg[r.Loja] || (agg[r.Loja] = { fQ: 0, sQ: 0, liq: 0, abs: 0, n: 0, nd: 0, vF: 0, vS: 0, vL: 0, vA: 0 }); a.n++; if (r.Dif !== 0) a.nd++; if (r.Dif < 0) { a.fQ += -r.Dif; a.vF += Math.abs(r.VD); } if (r.Dif > 0) { a.sQ += r.Dif; a.vS += r.VD; } a.liq += r.Dif; a.abs += Math.abs(r.Dif); a.vL += r.VD; a.vA += Math.abs(r.VD); }

  const wb = new ExcelJS.Workbook();
  const c = wb.addWorksheet('Contagens');
  c.addRow(['Data', 'Loja', 'Produto', 'Qtd_Estoque_Sistema', 'Qtd_Encontrada_Fisico', 'Diferenca', 'Status', 'Responsável pelo Balanço', 'Valor Unitário (R$)', 'Valor da Divergência (R$)', 'AJUSTADO POR']);
  for (const r of rows) c.addRow([r.Data, r.Loja, r.Produto, r.QS, r.QF, r.Dif, r.Status, r.Resp, r.VU, r2(r.VD), '']);
  const d = wb.addWorksheet('Dashboard');
  d.addRow(['Loja', 'Total_Faltando', 'Total_Sobrando', 'Divergencia_Liquida', 'Divergencia_Absoluta', 'Qtde_Contagens', 'Qtde_Com_Divergencia', '%_Sem_Divergencia', 'Valor_Faltando_R$', 'Valor_Sobrando_R$', 'Valor_Líquido_R$', 'Valor_Absoluto_R$']);
  const dashRows = Object.keys(agg).sort().map(l => { const a = agg[l]; return [l, a.fQ, a.sQ, a.liq, a.abs, a.n, a.nd, a.n ? Math.round((a.n - a.nd) / a.n * 100) : 0, r2(a.vF), r2(a.vS), r2(a.vL), r2(a.vA)]; });
  for (const dr of dashRows) d.addRow(dr);

  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  const up = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${DEST}?uploadType=media&supportsAllDrives=true`, { method: 'PATCH', headers: { Authorization: `Bearer ${tk}`, 'Content-Type': XLSX_MIME }, body: buf });
  if (!up.ok) throw new Error('upload: ' + up.status + ' ' + (await up.text()).slice(0, 200));
  console.log(new Date().toISOString(), 'bridge OK ->', rows.length, 'contagens,', dashRows.length, 'lojas, arquivo do dashboard atualizado.');
})().catch(e => { console.error(new Date().toISOString(), 'bridge ERRO:', e.message); process.exit(1); });
