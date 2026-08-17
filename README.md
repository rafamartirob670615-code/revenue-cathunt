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

Variable requerida para la persistencia y lectura de CANÓNICOS: `SUPABASE_DATABASE_URL`.
`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` sólo son opcionales para la
compatibilidad del callback SSO. Consulta `.env.example`; nunca guardes valores
secretos en Git ni expongas credenciales al navegador.

El modo publicado actual es un piloto con datos sintéticos no comerciales y una
identidad piloto compartida, por lo que funciona sin iniciar sesión en cualquier
navegador. Antes de conectar datos reales, esta identidad debe sustituirse por
un login propio del producto. Las versiones anteriores del Site son historial
técnico; la versión vigente se registra en `ESTADO.md` de la raíz maestra.

## Migración de plataforma

El corte de Cloudflare se conserva temporalmente como reversión hasta validar
la publicación de Vercel. El respaldo de D1 y el procedimiento están
documentados en `docs/MIGRACION_CLOUDFLARE_A_VERCEL_SUPABASE_2026-08-13.md`.
