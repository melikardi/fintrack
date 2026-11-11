import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  MaxLength,
} from 'class-validator';
import { TransactionType } from '../../generated/prisma/client';

// Maior valor de uma coluna Int no Postgres (≈ R$ 21 milhões em centavos)
const MAX_INT32 = 2_147_483_647;

export class CreateTransactionDto {
  // Sempre positivo: o sinal vem de `type` (INCOME/EXPENSE)
  @ApiProperty({
    type: 'integer',
    example: 15990,
    description: 'Valor em centavos (R$ 159,90 = 15990). Sempre positivo.',
  })
  @IsInt()
  @IsPositive()
  @Max(MAX_INT32)
  amountCents: number;

  @IsEnum(TransactionType)
  type: TransactionType;

  @IsDateString({ strict: true })
  date: string;

  @IsUUID()
  categoryId: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}
