import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { CategoriesService } from '../categories/categories.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { ListBudgetsQuery } from './dto/list-budgets.query';
import { UpdateBudgetDto } from './dto/update-budget.dto';

const budgetSelect = {
  id: true,
  year: true,
  month: true,
  limitCents: true,
  category: { select: { id: true, name: true } },
} satisfies Prisma.BudgetSelect;

@Injectable()
export class BudgetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categories: CategoriesService,
  ) {}

  async create(userId: string, dto: CreateBudgetDto) {
    // Lança 404 se a categoria não existe ou é de outro usuário
    await this.categories.findOne(userId, dto.categoryId);
    try {
      return await this.prisma.budget.create({
        data: {
          categoryId: dto.categoryId,
          year: dto.year,
          month: dto.month,
          limitCents: dto.limitCents,
          userId,
        },
        select: budgetSelect,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Já existe orçamento para essa categoria nesse mês',
        );
      }
      throw error;
    }
  }

  findAll(userId: string, query: ListBudgetsQuery) {
    return this.prisma.budget.findMany({
      where: { userId, year: query.year, month: query.month },
      select: budgetSelect,
      orderBy: [
        { year: 'desc' },
        { month: 'desc' },
        { category: { name: 'asc' } },
      ],
    });
  }

  async findOne(userId: string, id: string) {
    const budget = await this.prisma.budget.findFirst({
      where: { id, userId },
      select: budgetSelect,
    });
    if (!budget) {
      throw new NotFoundException('Orçamento não encontrado');
    }
    return budget;
  }

  async update(userId: string, id: string, dto: UpdateBudgetDto) {
    await this.findOne(userId, id);
    return this.prisma.budget.update({
      where: { id },
      data: { limitCents: dto.limitCents },
      select: budgetSelect,
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    await this.prisma.budget.delete({ where: { id } });
  }
}
