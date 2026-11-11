import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CategoriesService } from './categories.service';

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('erro', {
    code,
    clientVersion: 'test',
  });

describe('CategoriesService', () => {
  let service: CategoriesService;
  const prisma = {
    category: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const userId = 'user-1';
  const category = { id: 'cat-1', name: 'Mercado' };

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(CategoriesService);
  });

  describe('create', () => {
    it('cria a categoria vinculada ao userId do token, com nome sem espaços extras', async () => {
      prisma.category.create.mockResolvedValue(category);

      await expect(
        service.create(userId, { name: '  Mercado  ' }),
      ).resolves.toEqual(category);
      expect(prisma.category.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: { name: 'Mercado', userId } }),
      );
    });

    it('lança 409 quando o nome já existe para o usuário (P2002)', async () => {
      prisma.category.create.mockRejectedValue(prismaError('P2002'));

      await expect(
        service.create(userId, { name: 'Mercado' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('repassa erros desconhecidos sem mascarar', async () => {
      const unexpected = new Error('db caiu');
      prisma.category.create.mockRejectedValue(unexpected);

      await expect(service.create(userId, { name: 'Mercado' })).rejects.toBe(
        unexpected,
      );
    });
  });

  describe('findAll', () => {
    it('lista apenas categorias do usuário, ordenadas por nome', async () => {
      prisma.category.findMany.mockResolvedValue([category]);

      await expect(service.findAll(userId)).resolves.toEqual([category]);
      expect(prisma.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId },
          orderBy: { name: 'asc' },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('busca filtrando por id E userId', async () => {
      prisma.category.findFirst.mockResolvedValue(category);

      await expect(service.findOne(userId, 'cat-1')).resolves.toEqual(category);
      expect(prisma.category.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'cat-1', userId } }),
      );
    });

    it('lança 404 quando não existe ou pertence a outro usuário', async () => {
      prisma.category.findFirst.mockResolvedValue(null);

      await expect(service.findOne(userId, 'cat-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('atualiza quando a categoria pertence ao usuário', async () => {
      prisma.category.findFirst.mockResolvedValue(category);
      prisma.category.update.mockResolvedValue({ ...category, name: 'Feira' });

      await expect(
        service.update(userId, 'cat-1', { name: 'Feira' }),
      ).resolves.toEqual({ id: 'cat-1', name: 'Feira' });
    });

    it('não atualiza categoria de outro usuário (404)', async () => {
      prisma.category.findFirst.mockResolvedValue(null);

      await expect(
        service.update(userId, 'cat-1', { name: 'Feira' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.category.update).not.toHaveBeenCalled();
    });

    it('lança 409 ao renomear para um nome já usado (P2002)', async () => {
      prisma.category.findFirst.mockResolvedValue(category);
      prisma.category.update.mockRejectedValue(prismaError('P2002'));

      await expect(
        service.update(userId, 'cat-1', { name: 'Lazer' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('remove', () => {
    it('exclui quando a categoria pertence ao usuário', async () => {
      prisma.category.findFirst.mockResolvedValue(category);
      prisma.category.delete.mockResolvedValue(category);

      await expect(service.remove(userId, 'cat-1')).resolves.toBeUndefined();
      expect(prisma.category.delete).toHaveBeenCalledWith({
        where: { id: 'cat-1' },
      });
    });

    it('não exclui categoria de outro usuário (404)', async () => {
      prisma.category.findFirst.mockResolvedValue(null);

      await expect(service.remove(userId, 'cat-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.category.delete).not.toHaveBeenCalled();
    });

    it('lança 409 quando há transações vinculadas (P2003)', async () => {
      prisma.category.findFirst.mockResolvedValue(category);
      prisma.category.delete.mockRejectedValue(prismaError('P2003'));

      await expect(service.remove(userId, 'cat-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });
});
