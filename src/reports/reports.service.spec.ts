import { Test } from '@nestjs/testing';
import { monthRange } from '../common/month';
import { PrismaService } from '../prisma/prisma.service';
import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  let service: ReportsService;
  const prisma = {
    transaction: { groupBy: jest.fn() },
    category: { findMany: jest.fn() },
    budget: { findMany: jest.fn() },
  };
  const userId = 'user-1';
  const sum = (amountCents: number | null) => ({ _sum: { amountCents } });

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [ReportsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(ReportsService);
  });

  describe('monthRange', () => {
    it('gera [primeiro dia do mês, primeiro dia do mês seguinte) em UTC', () => {
      expect(monthRange(2026, 11)).toEqual({
        gte: new Date('2026-11-01T00:00:00.000Z'),
        lt: new Date('2026-12-01T00:00:00.000Z'),
      });
    });

    it('dezembro vira janeiro do ano seguinte', () => {
      expect(monthRange(2026, 12).lt).toEqual(
        new Date('2027-01-01T00:00:00.000Z'),
      );
    });
  });

  describe('summary', () => {
    it('soma receitas e despesas do mês e calcula o saldo', async () => {
      prisma.transaction.groupBy.mockResolvedValue([
        { type: 'INCOME', ...sum(500000) },
        { type: 'EXPENSE', ...sum(312000) },
      ]);

      await expect(service.summary(userId, 2026, 11)).resolves.toEqual({
        year: 2026,
        month: 11,
        incomeCents: 500000,
        expenseCents: 312000,
        balanceCents: 188000,
      });
      expect(prisma.transaction.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          by: ['type'],
          where: { userId, date: monthRange(2026, 11) },
        }),
      );
    });

    it('mês sem transações retorna zeros', async () => {
      prisma.transaction.groupBy.mockResolvedValue([]);

      await expect(service.summary(userId, 2026, 11)).resolves.toMatchObject({
        incomeCents: 0,
        expenseCents: 0,
        balanceCents: 0,
      });
    });

    it('saldo pode ser negativo', async () => {
      prisma.transaction.groupBy.mockResolvedValue([
        { type: 'EXPENSE', ...sum(1000) },
      ]);

      await expect(service.summary(userId, 2026, 11)).resolves.toMatchObject({
        balanceCents: -1000,
      });
    });
  });

  describe('expensesByCategory', () => {
    it('junta totais com nomes, ordenado do maior gasto para o menor', async () => {
      prisma.transaction.groupBy.mockResolvedValue([
        { categoryId: 'c-lazer', ...sum(21000) },
        { categoryId: 'c-mercado', ...sum(95000) },
      ]);
      prisma.category.findMany.mockResolvedValue([
        { id: 'c-lazer', name: 'Lazer' },
        { id: 'c-mercado', name: 'Mercado' },
      ]);

      await expect(
        service.expensesByCategory(userId, 2026, 11),
      ).resolves.toEqual([
        { categoryId: 'c-mercado', name: 'Mercado', expenseCents: 95000 },
        { categoryId: 'c-lazer', name: 'Lazer', expenseCents: 21000 },
      ]);
      expect(prisma.transaction.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId, type: 'EXPENSE' }),
        }),
      );
      expect(prisma.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId, id: { in: ['c-lazer', 'c-mercado'] } },
        }),
      );
    });

    it('sem despesas não consulta categorias', async () => {
      prisma.transaction.groupBy.mockResolvedValue([]);

      await expect(
        service.expensesByCategory(userId, 2026, 11),
      ).resolves.toEqual([]);
      expect(prisma.category.findMany).not.toHaveBeenCalled();
    });
  });

  describe('budgetStatus', () => {
    it('compara orçado × gasto, inclusive categoria sem gasto', async () => {
      prisma.budget.findMany.mockResolvedValue([
        { limitCents: 30000, category: { id: 'c-lazer', name: 'Lazer' } },
        { limitCents: 80000, category: { id: 'c-mercado', name: 'Mercado' } },
        { limitCents: 3000, category: { id: 'c-pet', name: 'Pet' } },
      ]);
      prisma.transaction.groupBy.mockResolvedValue([
        { categoryId: 'c-lazer', ...sum(30000) },
        { categoryId: 'c-mercado', ...sum(95000) },
      ]);

      await expect(service.budgetStatus(userId, 2026, 11)).resolves.toEqual([
        {
          categoryId: 'c-lazer',
          name: 'Lazer',
          limitCents: 30000,
          spentCents: 30000,
          remainingCents: 0,
          percentUsed: 100,
          exceeded: false, // gastar exatamente o limite não é estourar
        },
        {
          categoryId: 'c-mercado',
          name: 'Mercado',
          limitCents: 80000,
          spentCents: 95000,
          remainingCents: -15000,
          percentUsed: 118.75,
          exceeded: true,
        },
        {
          categoryId: 'c-pet',
          name: 'Pet',
          limitCents: 3000,
          spentCents: 0,
          remainingCents: 3000,
          percentUsed: 0,
          exceeded: false,
        },
      ]);
    });
  });
});
