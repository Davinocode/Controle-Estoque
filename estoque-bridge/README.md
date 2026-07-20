# estoque-bridge

Ponte automática entre o app de contagem de estoque (**Controle-Estoque**) e o
**Dashboard de Auditoria de Estoque**. Roda no Railway como **cron a cada 5 minutos**.

## Por que existe

- O app grava cada conferência numa **planilha nativa do Google Sheets** (append barato de 1 linha).
- O dashboard só consegue ler um **arquivo .xlsx** (ele baixa o binário; não lê planilha nativa).

Este serviço faz a conversão: lê a planilha do app, normaliza e regrava o arquivo `.xlsx`
que o dashboard consome. Assim, conferência feita no app aparece no dashboard sozinha.

## Fluxo

```
Gestor confere no app
  └─▶ planilha do app (Google Sheet nativa)
       └─▶ estoque-bridge (cron 5 min)  ← este serviço
            └─▶ arquivo .xlsx do dashboard
                 └─▶ dashboard (cron 5 min) → mostra
```

## O que o bridge faz a cada execução

- Lê todas as linhas da aba `Contagens` da planilha de origem.
- Canoniza nomes de loja (ex.: `CRSITAL`→`Cristal`, `CD CENTRAL`→`Santo Antônio CD`).
- Normaliza a data (número de série do Sheets → `DD/MM/AAAA`).
- Recalcula o **Valor da Divergência** (diferença × custo) e um **resumo por loja**
  (Faltou e Sobrou separados, nunca abatidos um do outro).
- Gera o `.xlsx` (abas `Contagens` + `Dashboard`) e sobrescreve o arquivo de destino no Drive.

Só **lê** a planilha de origem — nunca altera nem apaga os dados do app.

## Variáveis de ambiente

| Variável | Descrição |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Service account do Google (JSON). No Railway, referência: `${{controle-estoque.GOOGLE_SERVICE_ACCOUNT_JSON}}` |
| `GOOGLE_SPREADSHEET_ID` | ID da planilha de origem (nativa, escrita pelo app) |
| `DEST_FILE_ID` | ID do arquivo `.xlsx` de destino (lido pelo dashboard) |

## Deploy (Railway)

Cron configurado em `railway.json` (`*/5 * * * *`, restart `NEVER`). Deploy via:

```
railway up --service estoque-bridge
```
