# Especificação — Sistema de Contagem Cíclica de Estoque

## 1. Contexto

Rede com 10 estoques: lojas 001, 002, 003, 004, 005, 007, 008, 009, 012 e o CD 011.
Equipe de contagem: 1 motorista + 3 diretores (contam nas lojas) e Guilherme (conta
exclusivamente no CD 011). Hoje a contagem física é feita em papel, comunicada por
WhatsApp e digitada manualmente numa planilha que alimenta um dashboard. O gestor é
o único ponto de consolidação.

### Problemas identificados
1. **Sem controle de cobertura** — não há registro de quais itens já foram contados
   em cada loja, gerando contagens repetidas e itens esquecidos.
2. **Gargalo manual** — toda contagem passa por digitação manual numa planilha
   (data, loja, item, contador, custo, qtd. sistema, qtd. contada).
3. **Sem visibilidade em tempo real** — o gestor só sabe o que foi contado quando lê
   a mensagem do WhatsApp.
4. **Processo físico redundante** — anotar no papel E escrever a mensagem duplica o
   trabalho de quem conta.

### Decisão importante: sem integração com o sistema da empresa
O app **não se conecta** ao ERP/sistema da empresa. Quem faz a contagem física
(motorista, diretores, Guilherme) **nunca vê nem informa o saldo do sistema** —
apenas o saldo contado (o que está fisicamente na prateleira). Isso evita viés na
contagem e mantém o app simples de implantar.

A comparação com o saldo do sistema é um passo **manual e posterior**, feito pelo
gestor: ao revisar a contagem no dashboard, ele digita o saldo que está no
sistema da empresa (consultado por fora do app) e o app calcula a divergência e o
valor. Não há sincronização automática — é uma conferência, não uma integração.

## 2. Conceito central: Ciclo de Contagem

Cada estoque (loja ou CD) tem um **ciclo de contagem** ativo. Um ciclo é a lista
completa do catálogo. Cada item conta uma vez por ciclo. Quando todos os itens do
catálogo foram contados numa loja, o ciclo se encerra automaticamente e um novo
ciclo começa (contagem zerada, histórico preservado).

Isso resolve diretamente o problema de repetição/cobertura: o sistema nunca sugere
um item já contado no ciclo vigente, e mostra o percentual de progresso.

## 3. Personas

| Persona | Papel | Acesso |
|---|---|---|
| Motorista | Conta nas lojas | Lojas 001–009, 012 |
| Diretor 1 / 2 / 3 | Contam nas lojas | Lojas 001–009, 012 |
| Guilherme | Conta no CD | Somente CD 011 |
| Gestor (você) | Consolida, ajusta, acompanha | Todos os estoques + dashboard |

## 4. Modelo de dados

### Estoque
`codigo` (001…012, 011=CD), `nome` (apelido opcional, ex: "Moinhos"), `tipo` (loja | cd)

### Item (catálogo)
`sku`, `nome`, `categoria`, `preco_custo` — custo de referência mantido manualmente
no app (não vem do ERP), usado só para calcular o valor da divergência depois.

### Ciclo de contagem (por estoque)
`estoque`, `numero_ciclo`, `itens_contados` (lista de SKUs), `iniciado_em`, `encerrado_em`

### Registro de contagem (log, imutável na parte de contagem)
`id`, `data_hora`, `estoque`, `sku`, `nome_item`, `contador`, `saldo_contado`,
`numero_ciclo`. Campos preenchidos **depois**, só pelo gestor, na conferência:
`saldo_sistema` (informado manualmente), `divergencia` (=saldo_contado − saldo_sistema),
`valor_divergencia` (=divergencia × preco_custo), `status` (pendente_conferencia | conferido).

Importante: `saldo_sistema` nunca é solicitado a quem conta. É um campo que só existe
depois que o gestor confere manualmente cada item no dashboard.

## 5. Regra de sugestão de próxima contagem

Para cada estoque, calcular os itens do catálogo **ainda não contados no ciclo
vigente** e sugerir os 5 primeiros na ordem do catálogo (rotação sequencial simples,
já que não há saldo do sistema disponível para priorizar por valor em estoque).
Quem conta também pode buscar e registrar qualquer outro item do catálogo, não só
os 5 sugeridos.

Quando `itens_contados.length == catalogo.length`: encerrar ciclo, arquivar,
abrir `numero_ciclo + 1` com `itens_contados = []`.

## 6. Fluxos principais

### 6.1 Registrar contagem (motorista/diretor/Guilherme)
1. Abre o app no celular (link direto, sem instalação — PWA).
2. Seleciona seu nome (lista fixa de 5 pessoas — sem senha, é baixo risco).
3. Seleciona o estoque (Guilherme só vê CD 011).
4. Vê a lista de 5 itens sugeridos (não contados no ciclo) + opção de buscar
   qualquer outro item do catálogo.
5. Para cada item: digita apenas o **saldo contado** (o que está na prateleira) e
   confirma. Não vê e não informa nada sobre o sistema.
6. Sistema grava o registro, marca o item como contado no ciclo, e mostra confirmação.
7. Se o ciclo se completa, mostra aviso de "ciclo concluído" para aquele estoque.

Isso substitui integralmente o papel + a mensagem de WhatsApp: o próprio registro
já é a comunicação.

### 6.2 Lista de contagem (relatório dentro do app)
Tela que gera automaticamente, agrupado por loja, o mesmo formato que hoje é
escrito à mão para o WhatsApp:

```
Loja 007 Moinhos

Produto: Acrílico Branco SB Metalatex 18L
Saldo = 3
Contado por: Diretor 2

Produto: Acrílico Branco Novacor SB 18L
Saldo = 2
Contado por: Diretor 2
```

Filtrável por data e por estoque, com botão de copiar (por loja ou tudo de uma vez)
para quem ainda precisar repassar em algum outro canal durante a transição.

### 6.3 Conferir divergência e ajustar (gestor)
1. No painel, aba "Divergências", cada contagem aparece como **pendente de
   conferência** — só tem o saldo contado.
2. O gestor consulta o saldo no sistema da empresa (fora do app, por fora,
   sem integração) e digita esse valor no campo "saldo sistema" do item.
3. O app calcula automaticamente a divergência e o valor da divergência
   (`divergencia × preco_custo`) e marca o item como **conferido**.
4. Painel mostra métricas: quantos itens estão pendentes de conferência, quantos
   conferidos têm divergência, e o valor total em divergência.
5. Linhas com divergência ficam destacadas para o gestor priorizar o ajuste no
   sistema/ERP (esse ajuste em si continua acontecendo fora do app).
6. Exportação para CSV com todos os campos, inclusive os já conferidos, como ponte
   para a planilha/dashboard que já existe hoje.

### 6.4 Acompanhar (gestor, visão geral)
Painel mostra, para cada um dos 10 estoques: última contagem (item, quem, quando),
progresso do ciclo atual (% contado), e a sugestão de próximos itens.

## 7. Requisitos não funcionais
- **Mobile-first**: quem conta usa celular, andando pela loja. Botões grandes,
  poucos toques, sem scroll horizontal.
- **Sem fricção de login**: seleção de nome é suficiente dado o tamanho da equipe.
- **Baixa latência de entrada**: cada contagem deve levar poucos segundos para
  registrar (o gargalo de hoje é a burocracia, não a contagem em si).
- **Auditável**: todo registro é imutável e rastreável (quem, quando, o quê).
- **Evolutivo**: útil primeiro como PWA simples (Fase 1); depois integra com ERP
  (saldo do sistema automático) e substitui a planilha/dashboard atual (Fase 2).

## 8. Fases de implementação

**Fase 1 — MVP (1–2 semanas de desenvolvimento)**
Web app com banco simples (SQLite), sem autenticação real, catálogo e saldos
inseridos manualmente ou por importação de CSV. Cobre 100% do fluxo de registro
e do painel de acompanhamento. Já elimina papel, WhatsApp e digitação manual.

**Fase 2 — Integração**
Importação automática do saldo do sistema (ERP) via CSV/API. Exportação
automática para a planilha existente ou substituição direta do dashboard.
Login básico por PIN. Notificações (ex: divergência alta) via WhatsApp/e-mail.

**Fase 3 — Escala**
App mobile nativo/PWA instalável offline-first (contagem em área sem sinal),
histórico de auditoria completo, métricas de acurácia por contador/loja.
