import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive, IsUUID, Max } from 'class-validator';
import { MonthQuery } from '../../common/month.query';

const MAX_INT32 = 2_147_483_647;

export class CreateBudgetDto extends MonthQuery {
  @IsUUID()
  categoryId: string;

  @ApiProperty({
    type: 'integer',
    example: 80000,
    description: 'Limite do mês em centavos (R$ 800,00 = 80000).',
  })
  @IsInt()
  @IsPositive()
  @Max(MAX_INT32)
  limitCents: number;
}
