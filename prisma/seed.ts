import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const estoques = [
    { codigo: '001', nome: null, tipo: 'loja' },
    { codigo: '002', nome: null, tipo: 'loja' },
    { codigo: '003', nome: null, tipo: 'loja' },
    { codigo: '004', nome: null, tipo: 'loja' },
    { codigo: '005', nome: null, tipo: 'loja' },
    { codigo: '007', nome: null, tipo: 'loja' },
    { codigo: '008', nome: null, tipo: 'loja' },
    { codigo: '009', nome: null, tipo: 'loja' },
    { codigo: '011', nome: 'CD Central', tipo: 'cd' },
    { codigo: '012', nome: null, tipo: 'loja' },
  ]

  for (const estoque of estoques) {
    await prisma.estoque.upsert({
      where: { codigo: estoque.codigo },
      update: {},
      create: estoque,
    })
  }

  console.log('Seed concluído: 10 estoques criados.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
