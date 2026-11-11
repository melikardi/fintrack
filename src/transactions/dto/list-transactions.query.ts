import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { TransactionType } from '../../generated/prisma/client';

export const SORT_FIELDS = ['date', 'amountCents'] as const;
export const SORT_ORDERS = ['asc', 'desc'] as const;

export class ListTransactionsQuery {
  /** Início do período (inclusivo). */
  @IsOptional()
  @IsDateString({ strict: true })
  from?: string;

  /** Fim do período (exclusivo): `from=2026-11-01&to=2026-12-01` = novembro. */
  @IsOptional()
  @IsDateString({ strict: true })
  to?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  // Query string chega como texto; @Type converte para number antes de validar.
  // Campos com valor padrão: o plugin os marcaria como obrigatórios no Swagger,
  // por isso o @ApiPropertyOptional explícito.
  @ApiPropertyOptional({ type: 'integer', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    type: 'integer',
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @ApiPropertyOptional({ enum: SORT_FIELDS, default: 'date' })
  @IsOptional()
  @IsIn(SORT_FIELDS)
  sort: (typeof SORT_FIELDS)[number] = 'date';

  @ApiPropertyOptional({ enum: SORT_ORDERS, default: 'desc' })
  @IsOptional()
  @IsIn(SORT_ORDERS)
  order: (typeof SORT_ORDERS)[number] = 'desc';
}
