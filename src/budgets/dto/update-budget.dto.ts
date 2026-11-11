import { PickType } from '@nestjs/mapped-types';
import { CreateBudgetDto } from './create-budget.dto';

// Só o limite é editável. Categoria/mês identificam o orçamento:
// para mudá-los, exclui-se e cria-se outro (evita conflitos com o unique).
export class UpdateBudgetDto extends PickType(CreateBudgetDto, [
  'limitCents',
] as const) {}
