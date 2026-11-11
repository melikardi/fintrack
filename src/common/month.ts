import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

/** Campos ano/mês reutilizados em orçamentos e relatórios. */
export class MonthQuery {
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;
}

/**
 * Intervalo [início, fim) do mês em UTC.
 * Ex.: (2026, 11) → 2026-11-01T00:00Z até 2026-12-01T00:00Z (exclusivo).
 * Date.UTC trata month=12 → janeiro do ano seguinte automaticamente.
 */
export function monthRange(year: number, month: number) {
  return {
    gte: new Date(Date.UTC(year, month - 1, 1)),
    lt: new Date(Date.UTC(year, month, 1)),
  };
}
