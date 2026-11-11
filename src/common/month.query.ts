import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

/** Campos ano/mês reutilizados em orçamentos e relatórios. */
export class MonthQuery {
  /** @example 2026 */
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;

  /** Mês de 1 (janeiro) a 12 (dezembro). @example 11 */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;
}
