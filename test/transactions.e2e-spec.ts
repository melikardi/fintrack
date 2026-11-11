import request from 'supertest';
import { createTestContext, TestContext } from './helpers';

type Tx = { id: string; amountCents: number; date: string };
type Page = {
  data: Tx[];
  meta: { total: number; page: number; limit: number };
};

describe('Transactions (e2e)', () => {
  let ctx: TestContext;
  const server = () => ctx.app.getHttpServer();

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  afterAll(() => ctx.close());

  async function createCategory(auth: string, name: string) {
    const res = await request(server())
      .post('/categories')
      .set('Authorization', auth)
      .send({ name })
      .expect(201);
    return (res.body as { id: string }).id;
  }

  async function createTx(auth: string, body: Record<string, unknown>) {
    const res = await request(server())
      .post('/transactions')
      .set('Authorization', auth)
      .send(body)
      .expect(201);
    return res.body as Tx;
  }

  function list(auth: string, qs = '') {
    return request(server())
      .get(`/transactions${qs}`)
      .set('Authorization', auth);
  }

  it('exige autenticação (401)', () => {
    return request(server()).get('/transactions').expect(401);
  });

  it('CRUD completo do próprio usuário', async () => {
    const auth = await ctx.authAs();
    const categoryId = await createCategory(auth, 'Mercado');

    const created = await createTx(auth, {
      amountCents: 15990,
      type: 'EXPENSE',
      date: '2026-11-10T12:00:00.000Z',
      categoryId,
      description: '  Compra do mês  ',
    });
    expect(created).toEqual({
      id: expect.any(String),
      amountCents: 15990,
      type: 'EXPENSE',
      description: 'Compra do mês',
      date: '2026-11-10T12:00:00.000Z',
      createdAt: expect.any(String),
      category: { id: categoryId, name: 'Mercado' },
    });

    await request(server())
      .patch(`/transactions/${created.id}`)
      .set('Authorization', auth)
      .send({ amountCents: 20000 })
      .expect(200)
      .expect((res) => expect((res.body as Tx).amountCents).toBe(20000));

    await request(server())
      .delete(`/transactions/${created.id}`)
      .set('Authorization', auth)
      .expect(204);
    await request(server())
      .get(`/transactions/${created.id}`)
      .set('Authorization', auth)
      .expect(404);
  });

  it('valida a entrada (400)', async () => {
    const auth = await ctx.authAs();
    const categoryId = await createCategory(auth, 'Lazer');
    const valid = {
      amountCents: 1000,
      type: 'EXPENSE',
      date: '2026-11-10',
      categoryId,
    };
    const invalids = [
      { ...valid, amountCents: 10.5 }, // float: dinheiro é sempre centavos inteiros
      { ...valid, amountCents: -100 },
      { ...valid, amountCents: 0 },
      { ...valid, type: 'TRANSFER' },
      { ...valid, date: '10/11/2026' },
      { ...valid, categoryId: 'nao-e-uuid' },
      { ...valid, userId: categoryId }, // userId nunca vem do body
    ];
    for (const body of invalids) {
      await request(server())
        .post('/transactions')
        .set('Authorization', auth)
        .send(body)
        .expect(400);
    }

    for (const qs of [
      '?limit=101',
      '?page=0',
      '?sort=description',
      '?order=up',
      '?from=2026-12-01&to=2026-11-01',
    ]) {
      await list(auth, qs).expect(400);
    }
  });

  it('filtra por período, categoria e tipo; pagina e ordena', async () => {
    const auth = await ctx.authAs();
    const food = await createCategory(auth, 'Comida');
    const salary = await createCategory(auth, 'Salário');

    await createTx(auth, {
      amountCents: 500000,
      type: 'INCOME',
      date: '2026-11-05',
      categoryId: salary,
    });
    await createTx(auth, {
      amountCents: 3000,
      type: 'EXPENSE',
      date: '2026-10-31T23:59:59.000Z',
      categoryId: food,
    });
    await createTx(auth, {
      amountCents: 2000,
      type: 'EXPENSE',
      date: '2026-11-01',
      categoryId: food,
    });
    await createTx(auth, {
      amountCents: 1000,
      type: 'EXPENSE',
      date: '2026-11-20',
      categoryId: food,
    });
    await createTx(auth, {
      amountCents: 4000,
      type: 'EXPENSE',
      date: '2026-12-01',
      categoryId: food,
    });

    // Novembro = [2026-11-01, 2026-12-01): exclui 31/10 e 01/12
    const nov = (await list(auth, '?from=2026-11-01&to=2026-12-01').expect(200))
      .body as Page;
    expect(nov.meta.total).toBe(3);
    // Padrão: data desc
    expect(nov.data.map((t) => t.amountCents)).toEqual([1000, 500000, 2000]);

    const novFood = (
      await list(
        auth,
        `?from=2026-11-01&to=2026-12-01&categoryId=${food}`,
      ).expect(200)
    ).body as Page;
    expect(novFood.data.map((t) => t.amountCents)).toEqual([1000, 2000]);

    const incomes = (await list(auth, '?type=INCOME').expect(200)).body as Page;
    expect(incomes.data.map((t) => t.amountCents)).toEqual([500000]);

    // Ordenação por valor asc, 2 por página
    const page1 = (
      await list(auth, '?sort=amountCents&order=asc&limit=2').expect(200)
    ).body as Page;
    const page2 = (
      await list(auth, '?sort=amountCents&order=asc&limit=2&page=2').expect(200)
    ).body as Page;
    const page3 = (
      await list(auth, '?sort=amountCents&order=asc&limit=2&page=3').expect(200)
    ).body as Page;
    expect(page1.meta).toEqual({ total: 5, page: 1, limit: 2 });
    expect(
      [...page1.data, ...page2.data, ...page3.data].map((t) => t.amountCents),
    ).toEqual([1000, 2000, 3000, 4000, 500000]);
  });

  it('isola usuários: transação e categoria alheias retornam 404', async () => {
    const alice = await ctx.authAs();
    const bob = await ctx.authAs();
    const aliceCategory = await createCategory(alice, 'Casa');
    const bobCategory = await createCategory(bob, 'Casa');
    const aliceTx = await createTx(alice, {
      amountCents: 100000,
      type: 'EXPENSE',
      date: '2026-11-10',
      categoryId: aliceCategory,
    });

    // Bob não vê, não edita e não apaga a transação da Alice
    await request(server())
      .get(`/transactions/${aliceTx.id}`)
      .set('Authorization', bob)
      .expect(404);
    await request(server())
      .patch(`/transactions/${aliceTx.id}`)
      .set('Authorization', bob)
      .send({ amountCents: 1 })
      .expect(404);
    await request(server())
      .delete(`/transactions/${aliceTx.id}`)
      .set('Authorization', bob)
      .expect(404);
    const bobList = (await list(bob).expect(200)).body as Page;
    expect(bobList.meta.total).toBe(0);

    // Bob não consegue usar a categoria da Alice (IDOR)
    await request(server())
      .post('/transactions')
      .set('Authorization', bob)
      .send({
        amountCents: 1,
        type: 'EXPENSE',
        date: '2026-11-10',
        categoryId: aliceCategory,
      })
      .expect(404);

    // Alice não consegue mover a própria transação para a categoria do Bob
    await request(server())
      .patch(`/transactions/${aliceTx.id}`)
      .set('Authorization', alice)
      .send({ categoryId: bobCategory })
      .expect(404);

    // Nada mudou para a Alice
    await request(server())
      .get(`/transactions/${aliceTx.id}`)
      .set('Authorization', alice)
      .expect(200)
      .expect((res) => expect((res.body as Tx).amountCents).toBe(100000));
  });
});
