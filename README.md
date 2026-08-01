# REVENUE

Aplicación privada de planeación anual comercial y monitoreo Billing.

## Producto vigente

- **Inicio:** elige entre Monitoreo o Crear un Plan.
- **Monitoreo:** consulta transversal del negocio completo para usuarios
  autenticados.
- **Construcción:** responsable del Plan y administrador pueden trabajar la
  cuenta; Marketing y Trade entregan aportaciones separadas.
- **Gobierno:** revisión y aprobación comercial son capacidades distintas.
- **Finanzas:** consulta autorizada, sin captura ni decisiones.

## Arquitectura única

La aplicación usa el Site privado existente con Cloudflare Worker, D1 para
persistencia, R2 para archivos, Drizzle, vinext/Vite, React/TypeScript y
SheetJS. No usa Supabase, Firebase ni Vercel como plataforma de ejecución.

Los bindings están declarados en `.openai/hosting.json`:

- `DB` → D1
- `FILES` → R2

## Desarrollo y validación

```bash
npm ci
npm run dev
npm run test:domain
npm run lint
npm run build
npm run start
```

La publicación privada se realiza en el mismo Site de REVENUE. Las versiones
anteriores del Site son historial técnico; la versión vigente se registra en
`ESTADO.md` de la raíz maestra.
