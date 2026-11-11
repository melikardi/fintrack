import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createTestContext, TestContext } from './helpers';

describe('Categories (e2e)', () => {
  let ctx: TestContext;
  let app: TestContext['app'];
  let prisma: TestContext['prisma'];
  const authAs = () => ctx.authAs();

  beforeAll(async () => {
    ctx = await createTestContext();
    ({ app, prisma } = ctx);
  });

  afterAll(() => ctx.close());

  it('exige autenticação (401)', () => {
    return request(app.getHttpServer()).get('/categories').expect(401);
  });

  it('CRUD completo do próprio usuário', async () => {
    const auth = await authAs();
    const server = app.getHttpServer();

    const created = await request(server)
      .post('/categories')
      .set('Authorization', auth)
      .send({ name: '  Mercado  ' })
      .expect(201);
    expect(created.body).toEqual({ id: expect.any(String), name: 'Mercado' });
    const id = (created.body as { id: string }).id;

    await request(server)
      .get('/categories')
      .set('Authorization', auth)
      .expect(200)
      .expect([{ id, name: 'Mercado' }]);

    await request(server)
      .get(`/categories/${id}`)
      .set('Authorization', auth)
      .expect(200);

    await request(server)
      .patch(`/categories/${id}`)
      .set('Authorization', auth)
      .send({ name: 'Feira' })
      .expect(200)
      .expect({ id, name: 'Feira' });

    await request(server)
      .delete(`/categories/${id}`)
      .set('Authorization', auth)
      .expect(204);

    await request(server)
      .get(`/categories/${id}`)
      .set('Authorization', auth)
      .expect(404);
  });

  it('valida a entrada (400)', async () => {
    const auth = await authAs();
    const server = app.getHttpServer();

    await request(server)
      .post('/categories')
      .set('Authorization', auth)
      .send({ name: '   ' })
      .expect(400);
    await request(server)
      .post('/categories')
      .set('Authorization', auth)
      .send({ name: 'x'.repeat(51) })
      .expect(400);
    // whitelist + forbidNonWhitelisted: userId no body é rejeitado
    await request(server)
      .post('/categories')
      .set('Authorization', auth)
      .send({ name: 'Lazer', userId: randomUUID() })
      .expect(400);
    await request(server)
      .get('/categories/nao-e-uuid')
      .set('Authorization', auth)
      .expect(400);
  });

  it('nome duplicado para o mesmo usuário retorna 409', async () => {
    const auth = await authAs();
    const server = app.getHttpServer();

    await request(server)
      .post('/categories')
      .set('Authorization', auth)
      .send({ name: 'Lazer' })
      .expect(201);
    await request(server)
      .post('/categories')
      .set('Authorization', auth)
      .send({ name: 'Lazer' })
      .expect(409);
  });

  it('isola usuários: categoria alheia retorna 404 e não aparece na listagem', async () => {
    const alice = await authAs();
    const bob = await authAs();
    const server = app.getHttpServer();

    const res = await request(server)
      .post('/categories')
      .set('Authorization', alice)
      .send({ name: 'Saúde' })
      .expect(201);
    const id = (res.body as { id: string }).id;

    // Mesmo nome é permitido para outro usuário (unique é por userId)
    await request(server)
      .post('/categories')
      .set('Authorization', bob)
      .send({ name: 'Saúde' })
      .expect(201);

    await request(server)
      .get(`/categories/${id}`)
      .set('Authorization', bob)
      .expect(404);
    await request(server)
      .patch(`/categories/${id}`)
      .set('Authorization', bob)
      .send({ name: 'Hack' })
      .expect(404);
    await request(server)
      .delete(`/categories/${id}`)
      .set('Authorization', bob)
      .expect(404);

    const list = await request(server)
      .get('/categories')
      .set('Authorization', bob)
      .expect(200);
    expect(list.body).not.toContainEqual(expect.objectContaining({ id }));

    // A categoria da Alice continua intacta
    await request(server)
      .get(`/categories/${id}`)
      .set('Authorization', alice)
      .expect(200)
      .expect({ id, name: 'Saúde' });
  });

  it('não exclui categoria com transações vinculadas (409)', async () => {
    const auth = await authAs();
    const server = app.getHttpServer();

    const res = await request(server)
      .post('/categories')
      .set('Authorization', auth)
      .send({ name: 'Aluguel' })
      .expect(201);
    const categoryId = (res.body as { id: string }).id;

    // Transações ainda não têm endpoint; cria direto no banco
    const { userId } = await prisma.category.findUniqueOrThrow({
      where: { id: categoryId },
      select: { userId: true },
    });
    await prisma.transaction.create({
      data: {
        amountCents: 150000,
        type: 'EXPENSE',
        date: new Date(),
        userId,
        categoryId,
      },
    });

    await request(server)
      .delete(`/categories/${categoryId}`)
      .set('Authorization', auth)
      .expect(409);
  });
});
