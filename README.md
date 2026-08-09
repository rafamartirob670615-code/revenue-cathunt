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

La aplicación usa un Cloudflare Worker independiente, D1 para persistencia, R2
para archivos, Drizzle, vinext/Vite, React/TypeScript y SheetJS. No depende de
ChatGPT, de sus encabezados de identidad ni de Vercel como plataforma de
ejecución.

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

El modo publicado actual es un piloto con datos sintéticos no comerciales y una
identidad piloto compartida, por lo que funciona sin iniciar sesión en cualquier
navegador. Antes de conectar datos reales, esta identidad debe sustituirse por
un login propio del producto. Las versiones anteriores del Site son historial
técnico; la versión vigente se registra en `ESTADO.md` de la raíz maestra.

## Publicación autónoma

La URL operativa independiente es:
`https://revenue-planning-app.rafamartirob670615.workers.dev`

Usa el Worker `revenue-planning-app` y la D1 `revenue-planning-db`. La publicación
no depende de `chatgpt.site` ni de iniciar sesión en ChatGPT.
