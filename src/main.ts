import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import helmet from 'helmet';
import bodyParser from 'body-parser';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

  app.use(
    helmet({
      contentSecurityPolicy:
        process.env.NODE_ENV === 'production' ? undefined : false,
    }),
  );
  app.use(compression());
  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  const port = Number(process.env.PORT) || 4400;
  const isProd = process.env.NODE_ENV === 'production';

  if (isProd) {
    const allowedOrigins = (
      process.env.ALLOWED_ORIGINS ??
      process.env.CORS_ORIGIN ??
      ''
    )
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
      .map((origin) => origin.replace(/\/$/, ''));

    app.enableCors({
      origin: (origin, cb) => {
        if (!origin) {
          return cb(null, true);
        }

        const normalized = origin.replace(/\/$/, '');
        if (allowedOrigins.includes(normalized)) {
          return cb(null, true);
        }

        return cb(new Error(`CORS blocked for origin: ${origin}`), false);
      },
      credentials: true,
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
      ],
      maxAge: 86400,
    });
  } else {
    app.enableCors({ origin: true, credentials: true });
  }

  app
    .getHttpAdapter()
    .get('/healthz', (_req, res) => res.status(200).send({ ok: true }));

  const swaggerConfig = new DocumentBuilder()
    .setTitle('OnePrint API')
    .setDescription('API documentation for OnePrint backend')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        in: 'header',
        name: 'Authorization',
      },
      'access-token',
    )
    .addSecurityRequirements('access-token')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('swagger', app, document);

  app.enableShutdownHooks();

  await app.listen(port, '0.0.0.0');
}
bootstrap();
