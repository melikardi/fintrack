import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { ListTransactionsQuery } from './dto/list-transactions.query';
import { UpdateTransactionDto } from './dto/update-transaction.dto';

const transactionSelect = {
  id: true,
  amountCents: true,
  type: true,
  description: true,
  date: true,
  createdAt: true,
  category: { select: { id: true, name: true } },
} satisfies Prisma.TransactionSelect;

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateTransactionDto) {
    await this.assertCategoryOwnership(userId, dto.categoryId);
    return this.prisma.transaction.create({
      data: {
        amountCents: dto.amountCents,
        type: dto.type,
        date: new Date(dto.date),
        description: dto.description || null,
        categoryId: dto.categoryId,
        userId,
      },
      select: transactionSelect,
    });
  }

  async findAll(userId: string, query: ListTransactionsQuery) {
    const { from, to, categoryId, type, page, limit, sort, order } = query;
    if (from && to && new Date(from) >= new Date(to)) {
      throw new BadRequestException('"from" deve ser anterior a "to"');
    }

    const where: Prisma.TransactionWhereInput = {
      userId,
      categoryId,
      type,
      date:
        from || to
          ? {
              gte: from ? new Date(from) : undefined,
              lt: to ? new Date(to) : undefined,
            }
          : undefined,
    };

    // findMany e count na mesma transação: total e página consistentes
    const [data, total] = await this.prisma.$transaction([
      this.prisma.transaction.findMany({
        where,
        select: transactionSelect,
        // id como desempate: ordenação estável entre páginas
        orderBy: [{ [sort]: order }, { id: order }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  async findOne(userId: string, id: string) {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id, userId },
      select: transactionSelect,
    });
    if (!transaction) {
      throw new NotFoundException('Transação não encontrada');
    }
    return transaction;
  }

  async update(userId: string, id: string, dto: UpdateTransactionDto) {
    await this.findOne(userId, id);
    if (dto.categoryId) {
      await this.assertCategoryOwnership(userId, dto.categoryId);
    }
    return this.prisma.transaction.update({
      where: { id },
      data: {
        amountCents: dto.amountCents,
        type: dto.type,
        date: dto.date ? new Date(dto.date) : undefined,
        // "" limpa a descrição; ausente mantém como está
        description:
          dto.description === undefined ? undefined : dto.description || null,
        categoryId: dto.categoryId,
      },
      select: transactionSelect,
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    await this.prisma.transaction.delete({ where: { id } });
  }

  /** Impede vincular transação à categoria de outro usuário (IDOR). */
  private async assertCategoryOwnership(userId: string, categoryId: string) {
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, userId },
      select: { id: true },
    });
    if (!category) {
      throw new NotFoundException('Categoria não encontrada');
    }
  }
}
