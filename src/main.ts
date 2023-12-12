import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { NestFactory } from '@nestjs/core';
import * as dotenv from 'dotenv';
import helmet from 'helmet';
import * as csurf from 'csurf';
import {
  HideObjectPropertyInterceptor,
  HttpExceptionFilter,
  JsonMaskInterceptor,
  LoggingInterceptor,
  TimeoutInterceptor,
} from '@schematics/index';
import { AppModule } from './app.module';

dotenv.config();

async function bootstrap() {
  const port = process.env.PORT ?? 8080;
  const app = await NestFactory.create(AppModule, { cors: { origin: '*' } });

  const config = new DocumentBuilder()
    .setTitle('SPRAAY API')
    .setDescription('The API for Spraay App')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        in: 'header',
      },
      'JWT',
    )
    .build();
  const document: OpenAPIObject = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);
  await app.listen(port);
  app.use(helmet());
  app.use(csurf());
  app.useGlobalInterceptors(new HideObjectPropertyInterceptor());
  app.useGlobalInterceptors(new JsonMaskInterceptor());
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.useGlobalInterceptors(new TimeoutInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableCors();
}
bootstrap();
