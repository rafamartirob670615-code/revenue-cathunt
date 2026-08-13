# Migración de REVENUE a Vercel y Supabase

Fecha: 13 de agosto de 2026  
Fuente validada: commit `e23646c` de `rafamartirob670615-code/revenue-cathunt`

## Inventario de origen

- Worker: `revenue-planning-app`.
- D1: `revenue-planning-db`, ID `9bfb409a-3ec6-4876-8ceb-3f5d97e4439b`.
- Tamaño reportado por D1: 348,160 bytes.
- Datos operativos: cero Planes y un usuario piloto sintético.
- R2: nunca fue habilitado; no existen buckets ni objetos que migrar.
- Respaldo local: `backups/cloudflare-migration-20260813/revenue-planning-db.sql`.
- SHA-256 del respaldo: `13156381d9b0e5a294317a7a1783e65eccc76cded65074ed9cdc89006715041e`.

## Destino

- Código: GitHub, repositorio `revenue-cathunt`.
- Ejecución: Next.js nativo en Vercel.
- Base: esquema privado `revenue` en el proyecto Supabase compartido de CatHunt.
- Archivos: tabla binaria privada `revenue.file_objects`; no requiere una clave
  global `service_role`.

## Controles de corte

1. Aplicar la migración SQL y verificar tablas, usuario y almacenamiento.
2. Configurar secretos server-only en Vercel.
3. Desplegar una vista previa y ejecutar pruebas funcionales.
4. Promover exactamente el artefacto validado.
5. Actualizar el registro `public.apps` del Hub con la URL final.
6. Conservar Cloudflare sin escrituras como reversión durante la validación.
7. Limpiar iCloud únicamente después de comprobar producción y respaldo.

No se debe eliminar D1 ni el Worker durante este corte. La desactivación de
Cloudflare es una decisión posterior y separada.
