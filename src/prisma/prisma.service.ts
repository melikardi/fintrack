import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

// Declaration merging: dá à classe os tipos do PrismaClient
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface PrismaService extends PrismaClient {}

@Injectable()
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    });
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}