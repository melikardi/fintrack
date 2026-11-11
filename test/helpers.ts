import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { setupApp } from './../src/setup-app';

export interface TestContext {
  app: INestApplication<App>;
  prisma: PrismaService;
  /** Registra um usuário novo e devolve o header Authorization. */
  authAs: () => Promise<string>;
  /** Apaga os usuários criados (cascade remove os dados deles) e fecha a app. */
  close: () => Promise<void>;
}

export async function createTestContext(): Promise<TestContext> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication<INestApplication<App>>();
  setupApp(app);
  await app.init();
  const prisma = app.get(PrismaService);
  const emails: string[] = [];

  async function authAs(): Promise<string> {
    const email = `e2e-${randomUUID()}@test.dev`;
    emails.push(email);
    const credentials = { email, password: 'senha-segura-123' };
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: 'E2E', ...credentials })
      .expect(201);
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send(credentials)
      .expect(201);
    return `Bearer ${(res.body as { accessToken: string }).accessToken}`;
  }

  async function close() {
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await app.close();
  }

  return { app, prisma, authAs, close };
}
