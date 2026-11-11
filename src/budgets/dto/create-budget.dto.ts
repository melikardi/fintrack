import { IsInt, IsPositive, IsUUID, Max } from 'class-validator';
import { MonthQuery } from '../../common/month';

const MAX_INT32 = 2_147_483_647;

export class CreateBudgetDto extends MonthQuery {
  @IsUUID()
  categoryId: string;

  @IsInt()
  @IsPositive()
  @Max(MAX_INT32)
  limitCents: number;
}
