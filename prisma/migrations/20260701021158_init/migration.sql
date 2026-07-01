-- CreateTable
CREATE TABLE "Estoque" (
    "codigo" TEXT NOT NULL,
    "nome" TEXT,
    "tipo" TEXT NOT NULL,

    CONSTRAINT "Estoque_pkey" PRIMARY KEY ("codigo")
);

-- CreateTable
CREATE TABLE "Item" (
    "sku" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "precoCusto" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("sku")
);

-- CreateTable
CREATE TABLE "Ciclo" (
    "id" SERIAL NOT NULL,
    "estoqueCodigo" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "iniciadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "encerradoEm" TIMESTAMP(3),

    CONSTRAINT "Ciclo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemContadoNoCiclo" (
    "cicloId" INTEGER NOT NULL,
    "sku" TEXT NOT NULL,

    CONSTRAINT "ItemContadoNoCiclo_pkey" PRIMARY KEY ("cicloId","sku")
);

-- CreateTable
CREATE TABLE "Contagem" (
    "id" SERIAL NOT NULL,
    "dataHora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estoqueCodigo" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "contador" TEXT NOT NULL,
    "saldoContado" INTEGER NOT NULL,
    "numeroCiclo" INTEGER NOT NULL,
    "cicloId" INTEGER NOT NULL,
    "saldoSistema" INTEGER,
    "divergencia" INTEGER,
    "valorDivergencia" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'pendente_conferencia',

    CONSTRAINT "Contagem_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Ciclo" ADD CONSTRAINT "Ciclo_estoqueCodigo_fkey" FOREIGN KEY ("estoqueCodigo") REFERENCES "Estoque"("codigo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemContadoNoCiclo" ADD CONSTRAINT "ItemContadoNoCiclo_cicloId_fkey" FOREIGN KEY ("cicloId") REFERENCES "Ciclo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemContadoNoCiclo" ADD CONSTRAINT "ItemContadoNoCiclo_sku_fkey" FOREIGN KEY ("sku") REFERENCES "Item"("sku") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contagem" ADD CONSTRAINT "Contagem_estoqueCodigo_fkey" FOREIGN KEY ("estoqueCodigo") REFERENCES "Estoque"("codigo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contagem" ADD CONSTRAINT "Contagem_sku_fkey" FOREIGN KEY ("sku") REFERENCES "Item"("sku") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contagem" ADD CONSTRAINT "Contagem_cicloId_fkey" FOREIGN KEY ("cicloId") REFERENCES "Ciclo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
