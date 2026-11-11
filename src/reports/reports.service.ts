import { Injectable } from '@nestjs/common';
import { monthRange } from '../common/month';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Relatórios mensais. As somas são feitas no Postgres (GROUP BY + SUM)
 * via groupBy do Prisma, em vez de carregar todas as transações na memória.
 */
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Receitas, despesas e saldo do mês. */
  async summary(userId: string, year: number, month: number) {
    const groups = await this.prisma.transaction.groupBy({
      by: ['type'],
      where: { userId, date: monthRange(year, month) },
      _sum: { amountCents: true },
    });
    const sumOf = (type: 'INCOME' | 'EXPENSE') =>
      groups.find((g) => g.type === type)?._sum.amountCents ?? 0;

    const incomeCents = sumOf('INCOME');
    const expenseCents = sumOf('EXPENSE');
    return {
      year,
      month,
      incomeCents,
      expenseCents,
      balanceCents: incomeCents - expenseCents,
    };
  }

  /** Despesas do mês agrupadas por categoria, da maior para a menor. */
  async expensesByCategory(userId: string, year: number, month: number) {
    const totals = await this.expenseTotalsByCategory(userId, year, month);
    if (totals.size === 0) return [];

    const categories = await this.prisma.category.findMany({
      where: { userId, id: { in: [...totals.keys()] } },
      select: { id: true, name: true },
    });

    return categories
      .map((c) => ({
        categoryId: c.id,
        name: c.name,
        expenseCents: totals.get(c.id) ?? 0,
      }))
      .sort(
        (a, b) =>
          b.expenseCents - a.expenseCents || a.name.localeCompare(b.name),
      );
  }

  /** Orçado × realizado para cada orçamento do mês. */
  async budgetStatus(userId: string, year: number, month: number) {
    const [budgets, totals] = await Promise.all([
      this.prisma.budget.findMany({
        where: { userId, year, month },
        select: {
          limitCents: true,
          category: { select: { id: true, name: true } },
        },
        orderBy: { category: { name: 'asc' } },
      }),
      this.expenseTotalsByCategory(userId, year, month),
    ]);

    return budgets.map(({ limitCents, category }) => {
      const spentCents = totals.get(category.id) ?? 0;
      return {
        categoryId: category.id,
        name: category.name,
        limitCents,
        spentCents,
        remainingCents: limitCents - spentCents,
        // Arredondado em 2 casas: 118.75 (%)
        percentUsed: Math.round((spentCents * 10000) / limitCents) / 100,
        exceeded: spentCents > limitCents,
      };
    });
  }

  /** Map categoryId → total de despesas do mês (uma única query agregada). */
  private async expenseTotalsByCategory(
    userId: string,
    year: number,
    month: number,
  ) {
    const groups = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: { userId, type: 'EXPENSE', date: monthRange(year, month) },
      _sum: { amountCents: true },
    });
    return new Map(
      groups.map((g) => [g.categoryId, g._sum.amountCents ?? 0] as const),
    );
  }
}
