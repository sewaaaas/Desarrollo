# CIDRIX Web

Interfaz web de CIDRIX para consultar y gestionar solicitudes de soporte técnico.

Se está desarrollando con React, TypeScript, Vite y Tailwind CSS. El frontend se conecta a la API de CIDRIX para el inicio de sesión, la gestión de tickets y otras funciones de la mesa de ayuda.

## Ejecutar en local

Necesitas Node.js 24 y la API de CIDRIX en funcionamiento.

Desde la carpeta `cidrix-web`:

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

La dirección de la API se configura en `.env.local`:

```env
VITE_API_URL=http://localhost:3000/api/v1
```

No guardes contraseñas ni tokens privados en variables `VITE_*`, porque se incluyen en la aplicación web.

## Comandos útiles

```powershell
npm test
npm run lint
npm run typecheck
npm run build
```

Este módulo sigue en desarrollo y se actualiza junto con el backend.
