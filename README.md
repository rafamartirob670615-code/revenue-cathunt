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
compartido de Supabase para CatHunt, React/TypeScript y
SheetJS. No depende de ChatGPT, encabezados privados, Cloudflare Workers, D1,
R2, vinext ni bindings de una plataforma específica.

CANÓNICOS es el propietario único de bases, catálogos, bibliotecas de
conocimiento, migraciones y datasets maestros. REVENUE sólo conserva interfaz,
lógica de planeación y adaptadores. La persistencia operativa vive en el esquema
privado `revenue` del backend compartido de CANÓNICOS; los binarios se guardan en
`revenue.file_objects`. El universo comercial se lee de `public.cuentas` y el
catálogo gobernado de building blocks de
`revenue.building_block_definitions`, siempre desde rutas servidoras.

La historia de esquemas y migraciones que antes vivía en esta app fue trasladada
a `CANONICOS/supabase/history/revenue/`. Las muestras pequeñas bajo
`tests/fixtures/` son exclusivamente sintéticas y regenerables.

## Desarrollo y validación

```bash
npm ci
npm run dev
npm run test:domain
npm run lint
npm run build
npm run start
```

Variables requeridas: `SUPABASE_DATABASE_URL` para la persistencia y lectura de
CANÓNICOS, `REVENUE_SESSION_SECRET` (mínimo 32 caracteres) para firmar las
cookies de sesión SSO, y `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` para canjear
el token de SSO del Hub (mismo patrón que el resto de las apps de CatHunt).
Consulta `.env.example`;
nunca guardes valores secretos en Git ni expongas credenciales al navegador.

Todo acceso a REVENUE exige sesión SSO autenticada contra CANÓNICOS; no existe
modo sin login. Las versiones anteriores del Site son historial técnico; la
versión vigente se registra en `ESTADO.md` de la raíz maestra.

## Migración de plataforma

Vercel + Supabase es la arquitectura única y validada en producción. El corte
de Cloudflare (D1/Workers) queda como historial técnico, no como plan de
reversión activo; el respaldo y el procedimiento seguido están documentados en
`docs/MIGRACION_CLOUDFLARE_A_VERCEL_SUPABASE_2026-08-13.md`.
