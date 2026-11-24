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
  if (process.env.NODE_ENV === 'production') app.getHttpAdapter().getInstance().set('trust proxy', 1);
  const database = app.get(DatabaseService);
  await database.query('SELECT 1');

  app.setGlobalPrefix('api');
  const frontendOrigin = new URL(process.env.FRONTEND_ORIGIN || 'http://localhost:3000').origin;
  const apiOrigin = process.env.NODE_ENV === 'production' ? undefined : `http://localhost:${Number(process.env.PORT) || 3001}`;
  app.enableCors({
    origin: [frontendOrigin, ...(apiOrigin ? [apiOrigin] : [])],
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  });

  // Cookie-authenticated mutations must come from the configured browser origin.
  app.use((req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
    const origin = req.get('origin');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && origin !== frontendOrigin && origin !== apiOrigin) {
      res.status(403).json({ statusCode: 403, message: 'Origen no permitido' });
      return;
    }
    next();
  });

  const PgStore = connectPgSimple(session);
  app.use(session({
    name: 'micros.sid',
    secret,
    resave: false,
    saveUninitialized: false,
    store: new PgStore({ pool: database.getPool(), createTableIfMissing: true }),
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 1000,
    },
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
