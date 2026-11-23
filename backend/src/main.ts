import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import session = require('express-session');
import connectPgSimple = require('connect-pg-simple');
import { AppModule } from './app.module';
import { DatabaseService } from './database/database.service';

async function bootstrap() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET debe tener al menos 32 caracteres');

  const app = await NestFactory.create(AppModule);
  const database = app.get(DatabaseService);
  await database.query('SELECT 1');

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  });

  const PgStore = connectPgSimple(session);
  app.use(session({
    name: 'micros.sid',
    secret,
    resave: false,
    saveUninitialized: false,
    store: new PgStore({
    pool: database.getPool(),
    createTableIfMissing: true
    }),
    cookie: { httpOnly: true, sameSite: 'lax', secure: false, maxAge: 60 * 60 * 1000 },
  }));

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  const openApiConfig = new DocumentBuilder()
    .setTitle('RUTABOL-SCZ API')
    .setDescription('API del sistema de transporte RUTABOL-SCZ. Para probar rutas protegidas, inicia sesión primero en POST /api/auth/login; la sesión usa la cookie micros.sid.')
    .setVersion('1.0.0')
    .build();
  const openApiDocument = SwaggerModule.createDocument(app, openApiConfig);
  SwaggerModule.setup('docs', app, openApiDocument, {
    useGlobalPrefix: true,
    swaggerOptions: { withCredentials: true },
  });

  await app.listen(Number(process.env.PORT) || 3001);
  console.log('API RUTABOL-SCZ disponible en http://localhost:3001/api');
  console.log('Swagger disponible en http://localhost:3001/api/docs');
}
bootstrap().catch(err => { console.error(err); process.exit(1); });
