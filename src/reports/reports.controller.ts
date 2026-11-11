import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/current-user.decorator';
import { MonthQuery } from '../common/month.query';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('summary')
  summary(@CurrentUser() user: AuthUser, @Query() q: MonthQuery) {
    return this.reports.summary(user.userId, q.year, q.month);
  }

  @Get('by-category')
  byCategory(@CurrentUser() user: AuthUser, @Query() q: MonthQuery) {
    return this.reports.expensesByCategory(user.userId, q.year, q.month);
  }

  @Get('budget-status')
  budgetStatus(@CurrentUser() user: AuthUser, @Query() q: MonthQuery) {
    return this.reports.budgetStatus(user.userId, q.year, q.month);
  }
}
