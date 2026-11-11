import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

const categorySelect = { id: true, name: true } satisfies Prisma.CategorySelect;

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateCategoryDto) {
    try {
      return await this.prisma.category.create({
        data: { name: dto.name.trim(), userId },
        select: categorySelect,
      });
    } catch (error) {
      throw this.mapPrismaError(error);
    }
  }

  findAll(userId: string) {
    return this.prisma.category.findMany({
      where: { userId },
      select: categorySelect,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(userId: string, id: string) {
    // Filtra por id E userId: categoria de outro usuário "não existe" (404).
    const category = await this.prisma.category.findFirst({
      where: { id, userId },
      select: categorySelect,
    });
    if (!category) {
      throw new NotFoundException('Categoria não encontrada');
    }
    return category;
  }

  async update(userId: string, id: string, dto: UpdateCategoryDto) {
    await this.findOne(userId, id);
    try {
      return await this.prisma.category.update({
        where: { id },
        data: { name: dto.name.trim() },
        select: categorySelect,
      });
    } catch (error) {
      throw this.mapPrismaError(error);
    }
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    try {
      await this.prisma.category.delete({ where: { id } });
    } catch (error) {
      throw this.mapPrismaError(error);
    }
  }

  private mapPrismaError(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // P2002: violou @@unique([userId, name])
      if (error.code === 'P2002') {
        return new ConflictException('Já existe uma categoria com esse nome');
      }
      // P2003: FK — ainda há transações usando a categoria
      if (error.code === 'P2003') {
        return new ConflictException(
          'Categoria possui transações vinculadas e não pode ser excluída',
        );
      }
    }
    return error;
  }
}
