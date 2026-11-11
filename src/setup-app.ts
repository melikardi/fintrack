import { INestApplication, ValidationPipe } from '@nestjs/common';

/**
 * Configuração global compartilhada entre main.ts e os testes e2e,
 * para que os testes rodem com exatamente as mesmas regras da aplicação.
 */
export function setupApp(app: INestApplication): void {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      // Entrega ao controller a instância do DTO já convertida
      // (ex.: "?page=2" vira number, @Transform de trim é aplicado).
      transform: true,
    }),
  );
}
