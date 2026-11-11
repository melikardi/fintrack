import { Module } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CategoriesController } from './categories.controller';

@Module({
  providers: [CategoriesService],
  controllers: [CategoriesController],
  // Outros módulos reutilizam findOne para checar o dono da categoria
  exports: [CategoriesService],
})
export class CategoriesModule {}
