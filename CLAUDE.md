# CLAUDE.md

Contexto para o Claude Code trabalhar neste projeto. Leia também `ESPECIFICACAO.md`
na raiz — é a fonte da verdade sobre regras de negócio.

## O que é este projeto

Sistema de contagem cíclica de estoque para uma rede com 10 estoques (lojas 001,
002, 003, 004, 005, 007, 008, 009, 012 + CD 011). Substitui um processo manual em
papel + WhatsApp + planilha por um app web mobile-first onde:

- Motorista, Diretor 1, Diretor 2 e Diretor 3 contam itens em qualquer loja.
- Guilherme conta exclusivamente no CD 011.
- O gestor acompanha tudo num painel e ajusta divergências.

O conceito central é **ciclo de contagem**: cada estoque tem uma lista de itens do
catálogo ainda não contados no ciclo vigente. O app sempre sugere os próximos 5
itens a contar (rotação sequencial simples) e nunca repete um item já contado no
ciclo atual. Quando o ciclo fecha, reabre automaticamente.

**Importante: o app não se integra com o ERP/sistema da empresa.** Quem conta
(motorista, diretores, Guilherme) só informa o saldo físico contado — nunca vê nem
digita saldo de sistema. A comparação com o saldo do sistema é feita depois, manualmente,
pelo gestor, numa tela de conferência: ele digita o saldo do sistema por item (consultado
por fora do app) e o app calcula a divergência e o valor da divergência. Não implementar
nenhuma sincronização automática com sistemas externos nesta fase.

## Stack (Fase 1 — MVP)

- **Next.js (App Router) + TypeScript** — front e back no mesmo projeto, deploy fácil
  em Vercel, acessível via link no celular (PWA, sem loja de app).
- **SQLite via Prisma** (trocar por Postgres na Fase 2 sem dor, mesmo schema).
- **Tailwind CSS** para estilo.
- Sem autenticação real na Fase 1 — seleção de nome numa lista fixa (baixo risco,
  time pequeno). PIN opcional pode entrar na Fase 2.

Não usar bibliotecas de estado complexas (Redux etc.) — o app é pequeno, `useState`
+ server actions do Next.js resolvem.

## Modelo de dados (schema Prisma, resumo)

```
Estoque        { codigo (PK), nome (apelido opcional), tipo: "loja" | "cd" }
Item           { sku (PK), nome, categoria, precoCusto }        // custo de referência manual
Ciclo          { id, estoqueCodigo, numero, iniciadoEm, encerradoEm? }
ItemContadoNoCiclo { cicloId, sku }                              // marca cobertura
Contagem       { id, dataHora, estoqueCodigo, sku, contador, saldoContado, numeroCiclo,
                 saldoSistema?, divergencia?, valorDivergencia?,
                 status: "pendente_conferencia" | "conferido" }
```

`saldoSistema`, `divergencia`, `valorDivergencia` e `status` só são preenchidos na
tela de conferência do gestor, nunca na tela de registrar contagem. `Contagem` é
log imutável na parte de contagem — nunca editar `dataHora`, `saldoContado` etc.
depois de criado, só complementar os campos de conferência.

## Regras de negócio que não podem quebrar

1. Um item só aparece na lista de "sugestão" de uma loja se seu SKU **não** está em
   `ItemContadoNoCiclo` do ciclo vigente daquela loja.
2. Sugestão = 5 primeiros itens pendentes na ordem do catálogo (rotação simples; não
   há saldo de sistema disponível para priorizar por valor). Quem conta pode buscar e
   registrar qualquer outro item do catálogo além dos 5 sugeridos.
3. Ao registrar uma contagem: criar `Contagem` só com `saldoContado`, `contador`,
   `estoqueCodigo`, `sku`, `numeroCiclo` — nunca pedir ou mostrar saldo de sistema
   nesta tela. Inserir `ItemContadoNoCiclo`.
4. Se `ItemContadoNoCiclo` do ciclo vigente cobre 100% do catálogo: marcar `encerradoEm`
   no ciclo atual e criar um novo `Ciclo` (numero + 1) para aquela loja.
5. Guilherme só pode selecionar o estoque `011`. Motorista/Diretores não veem `011`
   na lista de seleção.
6. A tela de conferência (só o gestor usa) é o único lugar que grava `saldoSistema`.
   Ao salvar, calcular `divergencia = saldoContado - saldoSistema` e
   `valorDivergencia = divergencia * item.precoCusto`, e marcar `status = "conferido"`.
7. Existe uma tela de "lista de contagem" que agrupa `Contagem` por loja e data,
   no formato "Produto / Saldo = X / Contado por: Y" — é o que substitui a mensagem
   de WhatsApp de hoje.

## Estrutura de pastas esperada

```
app/
  registrar/         rota mobile-first de registro de contagem
  painel/            dashboard do gestor
  api/               server actions / route handlers
lib/
  db.ts              client Prisma
  ciclo.ts           lógica de sugestão e fechamento de ciclo
  export.ts          geração de CSV para a planilha existente
prisma/
  schema.prisma
  seed.ts            popula Estoque, Item, SaldoSistema de exemplo
ESPECIFICACAO.md
```

## Convenções

- Nomes de variáveis e comentários em português (é como o time do negócio pensa).
- Nomes de campos/tabelas em português também, para bater 1:1 com a especificação.
- Toda tela de "registrar" precisa funcionar bem em tela de celular pequena (360px)
  e com poucos toques — quem usa está andando pela loja.
- Nenhuma tela do painel deve travar por falta de dados: sempre tratar estoque com
  zero contagens (ciclo recém-aberto).

## Comandos

```
npm run dev          # desenvolvimento local
npx prisma migrate dev --name init   # criar schema
npx prisma db seed   # popular dados de exemplo (10 estoques + catálogo)
```

## Roadmap (não implementar tudo de uma vez)

1. Schema + seed + tela de registrar contagem (funcional, sem estilo bonito).
2. Lógica de sugestão + fechamento de ciclo (testar com catálogo pequeno primeiro).
3. Painel do gestor (fichas por loja + histórico + destaque de divergência).
4. Exportação CSV compatível com a planilha atual.
5. (Fase 2) Importação de saldo do sistema, PIN, notificações.

Ao começar, priorize ter o fluxo de "registrar contagem" ponta a ponta funcionando
antes de investir no painel — é o que elimina papel e WhatsApp primeiro.
