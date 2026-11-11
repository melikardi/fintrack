import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '../generated/prisma/client';
import { CategoriesService } from '../categories/categories.service';
import { PrismaService } from '../prisma/prisma.service';
import { BudgetsService } from './budgets.service';

describe('BudgetsService', () => {
  let service: BudgetsService;
  const prisma = {
    budget: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
  const categories = { findOne: jest.fn() };

  const userId = 'user-1';
  const dto = { categoryId: 'cat-1', year: 2026, month: 11, limitCents: 80000 };
  const budget = { id: 'b-1', ...dto };

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        BudgetsService,
        { provide: PrismaService, useValue: prisma },
        { provide: CategoriesService, useValue: categories },
      ],
    }).compile();
    service = moduleRef.get(BudgetsService);
  });

  describe('create', () => {
    it('cria com userId do token após checar o dono da categoria', async () => {
      categories.findOne.mockResolvedValue({ id: 'cat-1' });
      prisma.budget.create.mockResolvedValue(budget);

      await expect(service.create(userId, dto)).resolves.toEqual(budget);
      expect(categories.findOne).toHaveBeenCalledWith(userId, 'cat-1');
      expect(prisma.budget.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: { ...dto, userId } }),
      );
    });

    it('propaga 404 quando a categoria é de outro usuário', async () => {
      categories.findOne.mockRejectedValue(new NotFoundException());

      await expect(service.create(userId, dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.budget.create).not.toHaveBeenCalled();
    });

    it('lança 409 se já existe orçamento da categoria no mês (P2002)', async () => {
      categories.findOne.mockResolvedValue({ id: 'cat-1' });
      prisma.budget.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('erro', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(service.create(userId, dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  it('findAll filtra por usuário e período', async () => {
    prisma.budget.findMany.mockResolvedValue([budget]);

    await service.findAll(userId, { year: 2026, month: 11 });
    expect(prisma.budget.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId, year: 2026, month: 11 } }),
    );
  });

  it('findOne lança 404 para orçamento de outro usuário', async () => {
    prisma.budget.findFirst.mockResolvedValue(null);

    await expect(service.findOne(userId, 'b-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.budget.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'b-1', userId } }),
    );
  });

  it('update altera só o limite', async () => {
    prisma.budget.findFirst.mockResolvedValue(budget);
    prisma.budget.update.mockResolvedValue({ ...budget, limitCents: 1 });

    await service.update(userId, 'b-1', { limitCents: 1 });
    expect(prisma.budget.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'b-1' },
        data: { limitCents: 1 },
      }),
    );
  });

  it('remove não exclui orçamento de outro usuário', async () => {
    prisma.budget.findFirst.mockResolvedValue(null);

    await expect(service.remove(userId, 'b-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.budget.delete).not.toHaveBeenCalled();
  });
});
