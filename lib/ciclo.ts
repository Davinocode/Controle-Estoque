import { prisma } from './db'

export async function getCicloAtivo(estoqueCodigo: string) {
  let ciclo = await prisma.ciclo.findFirst({
    where: { estoqueCodigo, encerradoEm: null },
    orderBy: { numero: 'desc' },
  })

  if (!ciclo) {
    ciclo = await prisma.ciclo.create({
      data: { estoqueCodigo, numero: 1 },
    })
  }

  return ciclo
}

export async function getSugestoes(estoqueCodigo: string, limite = 5) {
  const ciclo = await getCicloAtivo(estoqueCodigo)

  // Usa relação (subquery) em vez de NOT IN para evitar o limite de 999 variáveis do SQLite
  const sugestoes = await prisma.item.findMany({
    where: {
      itensContados: {
        none: { cicloId: ciclo.id },
      },
    },
    orderBy: { sku: 'asc' },
    take: limite,
  })

  return { ciclo, sugestoes }
}

export async function registrarContagem(data: {
  estoqueCodigo: string
  sku: string
  contador: string
  saldoContado: number
}) {
  const ciclo = await getCicloAtivo(data.estoqueCodigo)

  const contagem = await prisma.contagem.create({
    data: {
      estoqueCodigo: data.estoqueCodigo,
      sku: data.sku,
      contador: data.contador,
      saldoContado: data.saldoContado,
      numeroCiclo: ciclo.numero,
      cicloId: ciclo.id,
    },
  })

  await prisma.itemContadoNoCiclo.upsert({
    where: { cicloId_sku: { cicloId: ciclo.id, sku: data.sku } },
    update: {},
    create: { cicloId: ciclo.id, sku: data.sku },
  })

  const [totalItens, totalContados] = await Promise.all([
    prisma.item.count(),
    prisma.itemContadoNoCiclo.count({ where: { cicloId: ciclo.id } }),
  ])

  if (totalItens > 0 && totalContados >= totalItens) {
    await prisma.ciclo.update({
      where: { id: ciclo.id },
      data: { encerradoEm: new Date() },
    })
    await prisma.ciclo.create({
      data: { estoqueCodigo: data.estoqueCodigo, numero: ciclo.numero + 1 },
    })
    return { contagem, cicloEncerrado: true, novoCiclo: ciclo.numero + 1 }
  }

  return { contagem, cicloEncerrado: false }
}
