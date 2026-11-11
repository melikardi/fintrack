import request from 'supertest';
import { createTestContext, TestContext } from './helpers';

describe('Budgets & Reports (e2e)', () => {
  let ctx: TestContext;
  const server = () => ctx.app.getHttpServer();

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  afterAll(() => ctx.close());

  async function post(auth: string, url: string, body: object) {
    const res = await request(server())
      .post(url)
      .set('Authorization', auth)
      .send(body)
      .expect(201);
    return res.body as { id: string };
  }

  function get(auth: string, url: string) {
    return request(server()).get(url).set('Authorization', auth);
  }

  it('exige autenticação (401)', async () => {
    await request(server()).get('/budgets').expect(401);
    await request(server())
      .get('/reports/summary?year=2026&month=11')
      .expect(401);
  });

  describe('budgets', () => {
    it('CRUD, 409 para duplicado e validação', async () => {
      const auth = await ctx.authAs();
      const { id: categoryId } = await post(auth, '/categories', {
        name: 'Mercado',
      });
      const body = { categoryId, year: 2026, month: 11, limitCents: 80000 };

      const budget = await post(auth, '/budgets', body);
      await request(server())
        .post('/budgets')
        .set('Authorization', auth)
        .send(body)
        .expect(409);

      for (const invalid of [
        { ...body, month: 13 },
        { ...body, month: 0 },
        { ...body, limitCents: 0 },
        { ...body, limitCents: 10.5 },
      ]) {
        await request(server())
          .post('/budgets')
          .set('Authorization', auth)
          .send(invalid)
          .expect(400);
      }

      await get(auth, '/budgets?year=2026&month=11')
        .expect(200)
        .expect((res) => expect(res.body).toHaveLength(1));
      await get(auth, '/budgets?year=2026&month=10').expect(200).expect([]);

      // PATCH só aceita limitCents (whitelist rejeita o resto)
      await request(server())
        .patch(`/budgets/${budget.id}`)
        .set('Authorization', auth)
        .send({ limitCents: 90000 })
        .expect(200)
        .expect((res) =>
          expect((res.body as { limitCents: number }).limitCents).toBe(90000),
        );
      await request(server())
        .patch(`/budgets/${budget.id}`)
        .set('Authorization', auth)
        .send({ limitCents: 1, month: 12 })
        .expect(400);

      await request(server())
        .delete(`/budgets/${budget.id}`)
        .set('Authorization', auth)
        .expect(204);
      await get(auth, `/budgets/${budget.id}`).expect(404);
    });

    it('isola usuários', async () => {
      const alice = await ctx.authAs();
      const bob = await ctx.authAs();
      const { id: aliceCategory } = await post(alice, '/categories', {
        name: 'Casa',
      });
      const budget = await post(alice, '/budgets', {
        categoryId: aliceCategory,
        year: 2026,
        month: 11,
        limitCents: 1000,
      });

      await get(bob, `/budgets/${budget.id}`).expect(404);
      await request(server())
        .patch(`/budgets/${budget.id}`)
        .set('Authorization', bob)
        .send({ limitCents: 1 })
        .expect(404);
      await request(server())
        .delete(`/budgets/${budget.id}`)
        .set('Authorization', bob)
        .expect(404);
      await get(bob, '/budgets').expect(200).expect([]);
      // Bob não cria orçamento na categoria da Alice
      await request(server())
        .post('/budgets')
        .set('Authorization', bob)
        .send({
          categoryId: aliceCategory,
          year: 2026,
          month: 11,
          limitCents: 1,
        })
        .expect(404);
    });
  });

  describe('reports', () => {
    it('calcula resumo, gastos por categoria e orçado × realizado', async () => {
      const auth = await ctx.authAs();
      const other = await ctx.authAs();
      const { id: salary } = await post(auth, '/categories', {
        name: 'Salário',
      });
      const { id: food } = await post(auth, '/categories', { name: 'Mercado' });
      const { id: fun } = await post(auth, '/categories', { name: 'Lazer' });
      const tx = (amountCents: number, type: string, date: string, c: string) =>
        post(auth, '/transactions', {
          amountCents,
          type,
          date,
          categoryId: c,
        });

      await tx(500000, 'INCOME', '2026-11-05', salary);
      await tx(60000, 'EXPENSE', '2026-11-01T00:00:00.000Z', food);
      await tx(35000, 'EXPENSE', '2026-11-30T23:59:59.000Z', food);
      await tx(21000, 'EXPENSE', '2026-11-15', fun);
      // Fora de novembro: não podem entrar
      await tx(99999, 'EXPENSE', '2026-10-31T23:59:59.000Z', food);
      await tx(99999, 'EXPENSE', '2026-12-01T00:00:00.000Z', food);

      // Dados de outro usuário não podem vazar para o relatório
      const { id: otherCat } = await post(other, '/categories', {
        name: 'Mercado',
      });
      await post(other, '/transactions', {
        amountCents: 777,
        type: 'EXPENSE',
        date: '2026-11-10',
        categoryId: otherCat,
      });

      await post(auth, '/budgets', {
        categoryId: food,
        year: 2026,
        month: 11,
        limitCents: 80000,
      });
      await post(auth, '/budgets', {
        categoryId: fun,
        year: 2026,
        month: 11,
        limitCents: 30000,
      });

      const q = '?year=2026&month=11';
      await get(auth, `/reports/summary${q}`).expect(200).expect({
        year: 2026,
        month: 11,
        incomeCents: 500000,
        expenseCents: 116000,
        balanceCents: 384000,
      });

      await get(auth, `/reports/by-category${q}`)
        .expect(200)
        .expect([
          { categoryId: food, name: 'Mercado', expenseCents: 95000 },
          { categoryId: fun, name: 'Lazer', expenseCents: 21000 },
        ]);

      await get(auth, `/reports/budget-status${q}`)
        .expect(200)
        .expect([
          {
            categoryId: fun,
            name: 'Lazer',
            limitCents: 30000,
            spentCents: 21000,
            remainingCents: 9000,
            percentUsed: 70,
            exceeded: false,
          },
          {
            categoryId: food,
            name: 'Mercado',
            limitCents: 80000,
            spentCents: 95000,
            remainingCents: -15000,
            percentUsed: 118.75,
            exceeded: true,
          },
        ]);
    });

    it('valida ano/mês (400)', async () => {
      const auth = await ctx.authAs();
      for (const qs of [
        '',
        '?year=2026',
        '?year=2026&month=13',
        '?year=abc&month=1',
      ]) {
        await get(auth, `/reports/summary${qs}`).expect(400);
      }
    });
  });
});
