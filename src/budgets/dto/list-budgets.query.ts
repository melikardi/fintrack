import { PartialType } from '@nestjs/swagger';
import { MonthQuery } from '../../common/month.query';

// year/month opcionais: sem eles, lista todos os orçamentos do usuário
export class ListBudgetsQuery extends PartialType(MonthQuery) {}
