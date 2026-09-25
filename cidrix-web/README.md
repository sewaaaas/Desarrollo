# CIDRIX Web

Frontend de CIDRIX, plataforma multi-tenant para gestión de soporte técnico. La aplicación usa React 19, Vite, TypeScript 5.8, Tailwind CSS y una arquitectura Feature-First.

## Requisitos

- Node.js 24
- npm 11
- CIDRIX API disponible

## Instalación

```bash
npm install
Copy-Item .env.example .env.local
npm run dev
```

En shells distintos de PowerShell, copia `.env.example` a `.env.local` con el comando equivalente.

## Variables de entorno

```env
VITE_API_URL=http://localhost:3000/api/v1
```

La aplicación valida la URL al iniciar. Las variables `VITE_*` son públicas en el bundle y nunca deben contener secretos.

## Comandos

```bash
npm run dev
npm run lint
npm run typecheck
npm test
npm run test:watch
npm run build
npm run preview
```

## Estructura

```text
src/
├── app/       # composición global, layouts, routing y boundaries
├── features/  # funcionalidad agrupada por dominio
├── shared/    # componentes, configuración, servicios y tipos reutilizables
├── styles/    # estilos globales y tokens semánticos
└── test/      # setup común de pruebas
```

Reglas principales:

- `app` puede importar desde `features` y `shared`.
- `features` puede importar desde `shared`.
- `shared` no importa desde `app` ni `features`.
- Una feature no consume internals de otra feature.
- La autorización y el aislamiento tenant siempre son responsabilidad final del backend.

FE-01 solo contiene infraestructura y páginas placeholder. Auth, Tickets, Dashboard, Notifications y Settings se implementan en sus fases correspondientes.
