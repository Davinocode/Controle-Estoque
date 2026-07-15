-- CreateTable
CREATE TABLE "EdicaoContagem" (
    "id" SERIAL NOT NULL,
    "contagemId" INTEGER NOT NULL,
    "saldoAntigo" INTEGER NOT NULL,
    "saldoNovo" INTEGER NOT NULL,
    "editadoPor" TEXT NOT NULL,
    "motivo" TEXT,
    "editadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EdicaoContagem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EdicaoContagem_contagemId_idx" ON "EdicaoContagem"("contagemId");

-- AddForeignKey
ALTER TABLE "EdicaoContagem" ADD CONSTRAINT "EdicaoContagem_contagemId_fkey" FOREIGN KEY ("contagemId") REFERENCES "Contagem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
