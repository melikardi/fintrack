# FinTrack

API REST de finanças pessoais (receitas, despesas, categorias, orçamentos e relatórios).
Projeto de portfólio: o código precisa ser limpo, testado e explicável em entrevista.

## Stack
- NestJS 12 + TypeScript (CommonJS: imports relativos SEM `.js`)
- PostgreSQL 16 via Docker Compose
- Prisma 7.10.1 com `@prisma/adapter-pg` (não atualizar para versões rc)
- Auth: JWT (`@nestjs/jwt`, `passport-jwt`) + hash de senha com argon2
- Validação: `class-validator` + `ValidationPipe` global (whitelist + forbidNonWhitelisted)

## Comandos (Windows, cmd)
- Subir banco: `docker compose up -d` (Docker Desktop precisa estar aberto)
- Dev: `npm run start:dev`
- Migration: `npx prisma migrate dev --name <nome>`
- Gerar client: `npx prisma generate`
- Testes: `npm test` / `npm run test:e2e`
- Lint: `npm run lint`

## Estrutura
- `src/<modulo>/` com `*.module.ts`, `*.service.ts`, `*.controller.ts` e `dto/`
- `src/prisma/` contém `PrismaService` (@Global). Usa declaration merging
  (`export interface PrismaService extends PrismaClient {}`) para tipar os métodos.
- Client do Prisma gerado em `src/generated/prisma` (NÃO versionado; importar de
  `../generated/prisma/client`).

## Regras de negócio e segurança (obrigatórias)
- Toda consulta a dados de usuário DEVE filtrar por `userId` vindo do token
  (`req.user.userId`). Nunca confiar em `userId` enviado no body.
- Recurso de outro usuário retorna 404 (não 403), para não revelar que o id existe.
- Dinheiro sempre em centavos (`Int`, campo `amountCents`). Nunca float.
- Nunca retornar `passwordHash`. Usar `select` explícito nas consultas de usuário.
- Mensagem de erro de login idêntica para e-mail inexistente e senha errada.
- Rotas protegidas usam `@UseGuards(JwtAuthGuard)`; ids de rota validados com `ParseUUIDPipe`.
- Toda entrada passa por DTO com validação.

## Git
- Nunca commitar direto na `main`: branch `feat/...`, `fix/...`, `chore/...` + Pull Request.
- Conventional Commits: `feat:`, `fix:`, `docs:`, `chore:`, `test:`, `refactor:`.
- Commits pequenos e frequentes. Antes de commitar, rodar `git status` e conferir
  que NÃO entram: `.env`, `src/generated/`, `node_modules/`.
- Nunca fazer `git push --force`, `git reset --hard` ou apagar branches sem eu pedir.

## Cuidados
- Nunca ler, imprimir ou commitar o conteúdo de `.env`. Atualizar `.env.example`
  quando criar variável nova (sem valores reais).
- Não rodar `npm audit fix --force`.
- O projeto está dentro do OneDrive; evitar mexer em `node_modules` manualmente.
- Ao instalar pacote, confirmar que `package.json` e `package-lock.json` aparecem
  modificados no `git status`.

## Como trabalhar comigo
- Sou estudante de Ciência da Computação buscando estágio/júnior. Explique brevemente
  o porquê das decisões para eu conseguir defendê-las em entrevista.
- Mostre o que vai mudar antes de alterar vários arquivos.
- Escreva testes (unitários nos services, e2e nos endpoints) junto com cada feature.
- Respostas em português.

## Roadmap
1. [x] Fundação: repo, Docker, Prisma, health check
2. [x] Autenticação JWT
3. [x] Categorias
4. [ ] Transações (filtros por período/categoria, paginação, ordenação)
5. [ ] Orçamentos mensais e relatórios
6. [ ] Testes, Swagger, Dockerfile, GitHub Actions, deploy
7. [ ] Frontend (React/Next.js)
