import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/**
 * Documentação OpenAPI em /docs (JSON em /docs-json).
 * Os schemas dos DTOs são gerados pelo plugin do @nestjs/swagger
 * (nest-cli.json), que lê os tipos TypeScript e os decorators do
 * class-validator em tempo de build.
 */
export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('FinTrack API')
    .setDescription(
      'API de finanças pessoais. Valores monetários sempre em centavos (inteiros).',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'docs-json',
    swaggerOptions: { persistAuthorization: true },
  });
}
