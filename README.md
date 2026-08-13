# REVENUE

Aplicación autónoma de planeación anual comercial y monitoreo Billing.

## Producto vigente

- **Inicio:** elige entre Monitoreo o Crear un Plan.
- **Monitoreo:** consulta transversal del negocio completo para el piloto.
- **Construcción:** responsable del Plan y administrador pueden trabajar la
  cuenta; Marketing y Trade entregan aportaciones separadas.
- **Gobierno:** revisión y aprobación comercial son capacidades distintas.
- **Finanzas:** consulta autorizada, sin captura ni decisiones.

## Arquitectura única

La aplicación usa Next.js nativo en Vercel y Postgres privado en el proyecto
compartido de Supabase para CatHunt, Drizzle, React/TypeScript y
SheetJS. No depende de ChatGPT, encabezados privados, Cloudflare Workers, D1,
R2, vinext ni bindings de una plataforma específica.

La persistencia y los archivos viven en el esquema privado `revenue`; los
binarios se guardan en `revenue.file_objects`. Vercel usa una sola credencial
limitada a ese esquema, exclusivamente en rutas servidoras, y nunca se expone
como variable `NEXT_PUBLIC_`.

## Desarrollo y validación

```bash
npm ci
npm run dev
npm run test:domain
npm run lint
npm run build
npm run start
```

Variable requerida: `SUPABASE_DATABASE_URL`. Consulta `.env.example`; nunca
guardes valores secretos en Git.

El modo publicado actual es un piloto con datos sintéticos no comerciales y una
identidad piloto compartida, por lo que funciona sin iniciar sesión en cualquier
navegador. Antes de conectar datos reales, esta identidad debe sustituirse por
un login propio del producto. Las versiones anteriores del Site son historial
técnico; la versión vigente se registra en `ESTADO.md` de la raíz maestra.

## Migración de plataforma

El corte de Cloudflare se conserva temporalmente como reversión hasta validar
la publicación de Vercel. El respaldo de D1 y el procedimiento están
documentados en `docs/MIGRACION_CLOUDFLARE_A_VERCEL_SUPABASE_2026-08-13.md`.
