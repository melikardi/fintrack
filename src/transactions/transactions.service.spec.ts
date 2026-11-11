import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { ListTransactionsQuery } from './dto/list-transactions.query';
import { TransactionsService } from './transactions.service';

describe('TransactionsService', () => {
  let service: TransactionsService;
  const prisma = {
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    category: { findFirst: jest.fn() },
    transaction: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const userId = 'user-1';
  const tx = { id: 'tx-1', amountCents: 1000 };
  const dto = {
    amountCents: 1000,
    type: 'EXPENSE' as const,
    date: '2026-11-10T12:00:00.000Z',
    categoryId: 'cat-1',
  };
  const query = (overrides: Partial<ListTransactionsQuery> = {}) =>
    Object.assign(new ListTransactionsQuery(), overrides);

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(TransactionsService);
  });

  describe('create', () => {
    it('cria com userId do token quando a categoria é do usuário', async () => {
      prisma.category.findFirst.mockResolvedValue({ id: 'cat-1' });
      prisma.transaction.create.mockResolvedValue(tx);

      await expect(service.create(userId, dto)).resolves.toEqual(tx);
      expect(prisma.category.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'cat-1', userId } }),
      );
      expect(prisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId,
            amountCents: 1000,
            date: new Date(dto.date),
          }),
        }),
      );
    });

    it('lança 404 se a categoria não pertence ao usuário', async () => {
      prisma.category.findFirst.mockResolvedValue(null);

      await expect(service.create(userId, dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.transaction.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    beforeEach(() => {
      prisma.transaction.findMany.mockResolvedValue([tx]);
      prisma.transaction.count.mockResolvedValue(41);
    });

    it('usa padrões: página 1, 20 itens, data desc, só do usuário', async () => {
      await expect(service.findAll(userId, query())).resolves.toEqual({
        data: [tx],
        meta: { total: 41, page: 1, limit: 20 },
      });
      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId }),
          orderBy: [{ date: 'desc' }, { id: 'desc' }],
          skip: 0,
          take: 20,
        }),
      );
    });

    it('aplica filtros, período [from, to) e paginação', async () => {
      await service.findAll(
        userId,
        query({
          from: '2026-11-01',
          to: '2026-12-01',
          categoryId: 'cat-1',
          type: 'INCOME',
          page: 3,
          limit: 10,
          sort: 'amountCents',
          order: 'asc',
        }),
      );
      const expectedWhere = {
        userId,
        categoryId: 'cat-1',
        type: 'INCOME',
        date: { gte: new Date('2026-11-01'), lt: new Date('2026-12-01') },
      };
      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expectedWhere,
          orderBy: [{ amountCents: 'asc' }, { id: 'asc' }],
          skip: 20,
          take: 10,
        }),
      );
      expect(prisma.transaction.count).toHaveBeenCalledWith({
        where: expectedWhere,
      });
    });

    it('lança 400 quando from >= to', async () => {
      await expect(
        service.findAll(
          userId,
          query({ from: '2026-12-01', to: '2026-11-01' }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('findOne', () => {
    it('lança 404 para transação inexistente ou de outro usuário', async () => {
      prisma.transaction.findFirst.mockResolvedValue(null);

      await expect(service.findOne(userId, 'tx-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.transaction.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'tx-1', userId } }),
      );
    });
  });

  describe('update', () => {
    it('não valida categoria quando ela não muda', async () => {
      prisma.transaction.findFirst.mockResolvedValue(tx);
      prisma.transaction.update.mockResolvedValue(tx);

      await service.update(userId, 'tx-1', { amountCents: 500 });
      expect(prisma.category.findFirst).not.toHaveBeenCalled();
    });

    it('lança 404 ao mover para categoria de outro usuário', async () => {
      prisma.transaction.findFirst.mockResolvedValue(tx);
      prisma.category.findFirst.mockResolvedValue(null);

      await expect(
        service.update(userId, 'tx-1', { categoryId: 'cat-alheia' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.transaction.update).not.toHaveBeenCalled();
    });

    it('limpa a descrição quando recebe string vazia', async () => {
      prisma.transaction.findFirst.mockResolvedValue(tx);
      prisma.transaction.update.mockResolvedValue(tx);

      await service.update(userId, 'tx-1', { description: '' });
      expect(prisma.transaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ description: null }),
        }),
      );
    });

    it('não atualiza transação de outro usuário (404)', async () => {
      prisma.transaction.findFirst.mockResolvedValue(null);

      await expect(
        service.update(userId, 'tx-1', { amountCents: 1 }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.transaction.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('exclui transação do usuário', async () => {
      prisma.transaction.findFirst.mockResolvedValue(tx);

      await expect(service.remove(userId, 'tx-1')).resolves.toBeUndefined();
      expect(prisma.transaction.delete).toHaveBeenCalledWith({
        where: { id: 'tx-1' },
      });
    });

    it('não exclui transação de outro usuário (404)', async () => {
      prisma.transaction.findFirst.mockResolvedValue(null);

      await expect(service.remove(userId, 'tx-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.transaction.delete).not.toHaveBeenCalled();
    });
  });
});
