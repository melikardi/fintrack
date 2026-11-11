import { PartialType } from '@nestjs/mapped-types';
import { MonthQuery } from '../../common/month';

// year/month opcionais: sem eles, lista todos os orçamentos do usuário
export class ListBudgetsQuery extends PartialType(MonthQuery) {}
