# CIDRIX API

Backend de CIDRIX, una plataforma para gestionar solicitudes de soporte técnico de distintas organizaciones.

Está desarrollado con NestJS, TypeScript, PostgreSQL y Prisma. Incluye autenticación, usuarios, tickets, comentarios, adjuntos, notificaciones y métricas de atención.

## Ejecutar en local

Necesitas Node.js 24, Docker y npm.

Desde la carpeta `cidrix-api`:

```powershell
Copy-Item .env.example .env
docker compose up -d
npm install
npx prisma generate
npx prisma migrate dev
npm run seed
npm run start:dev
```

Antes de iniciar, cambia los secretos JWT de `.env` por valores propios. No subas ese archivo al repositorio.

La API utiliza por defecto el puerto `3000` y el prefijo `/api/v1`.

## Pruebas

```powershell
npm test
npm run test:e2e
```

El proyecto sigue en desarrollo. Las notas y revisiones técnicas están en la carpeta [docs](../docs/).
