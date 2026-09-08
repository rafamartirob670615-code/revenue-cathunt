# Paquete de archivos sintéticos — Información (Paso 2 de 8)

Estos 12 archivos son el reemplazo real de la referencia rota que existía antes
(`outputs/demo_sintetica_oficial/`, que nunca se construyó). Sirven para dos cosas:

1. **Probar el flujo completo de Crear Plan** sin depender de un ERP real:
   súbelos tal cual en Información y los 4 obligatorios + 8 complementarios
   quedan en estado READY.
2. **Ser la plantilla literal para pedirle a un ERP real la misma información.**
   Cada archivo usa exactamente las columnas que el motor de validación exige
   (`domain/input-package.ts` y `domain/excel-intake.ts`). Cuando llegue el
   momento de conectar un ERP de verdad, este es el documento que se le entrega
   al equipo de TI/ERP: "necesitamos una exportación con estas columnas, en
   este formato, a este nivel de detalle".

Regenerar los archivos (por si cambian los datos de ejemplo):

```
node scripts/generate-erp-samples.ts
```

Validar que siguen pasando el motor real de validación:

```
node scripts/validate-erp-samples.ts
```

## Los 12 archivos

| Archivo | Requisito | Formato | Nivel de detalle |
| --- | --- | --- | --- |
| `historia_ventas.xlsx` | Historia de ventas (obligatorio) | Excel, encabezados en español libres | Cuenta × SKU × mes |
| `catalogo_correspondencias.csv` | Catálogo y correspondencias (obligatorio) | CSV, encabezados exactos | Código fuente ↔ ID canónico |
| `unidades_conversiones.csv` | Unidades y conversiones (obligatorio) | CSV, encabezados exactos | SKU × unidad origen × unidad base |
| `precios_moneda.csv` | Precios y moneda (obligatorio) | CSV, encabezados exactos | Cuenta × SKU × vigencia |
| `historia_promociones.csv` | Historia de promociones y actividades | CSV, encabezados exactos | Actividad × cuenta × SKU × periodo |
| `plan_marketing.xlsx` | Plan anual de Marketing | Excel, encabezados en español libres | Actividad × cuenta × SKU |
| `plan_trade_marketing.xlsx` | Plan anual de Trade Marketing | Excel, encabezados en español libres | Actividad × cuenta × SKU |
| `condiciones_comerciales.xlsx` | Condiciones comerciales | Excel, encabezados en español libres | Cuenta × SKU × vigencia |
| `costos_producto.xlsx` | Costos por producto | Excel, encabezados en español libres | SKU × vigencia |
| `inversion_actividades.xlsx` | Inversión de actividades | Excel, encabezados en español libres | Actividad × cuenta × SKU × periodo |
| `cuota_comercial.xlsx` | Cuota comercial | Excel, encabezados en español libres | Cuenta × SKU × mes |
| `ventas_actuales.xlsx` | Ventas actuales | Excel, encabezados en español libres | Cuenta × SKU × periodo × corte |

Cuenta usada: **UCM-0161 · Turmix de México** (la cuenta sintética designada del
ecosistema). Prefijo `SINTETICO_V2_NO_COMERCIAL_` en todos los nombres — el
sistema lo usa para marcar el Plan resultante como no comercial.

## Cuando llegue un ERP real

La forma más confiable de no romper la funcionalidad al cambiar de datos
sintéticos a datos reales:

1. **Manda este mismo paquete al equipo de TI/ERP como especificación**, no
   una descripción en prosa. Columna por columna, tipo de dato por tipo de
   dato — es exactamente lo que el parser exige.
2. **Pide la primera exportación real en el mismo formato de archivo** (Excel
   para historia de ventas y las fuentes de crecimiento/financieras, CSV para
   catálogo/conversiones/precios/promociones) para minimizar sorpresas de
   parseo.
3. **Sube esa primera exportación real a un Plan de prueba** (no al Plan de
   producción) y valida que quede READY antes de tocar nada del código. Si
   falla, el motor te dice exactamente qué columna faltó o qué fila es
   inválida — ahí se ve rápido si es un problema de mapeo de columnas o de
   calidad del dato de origen.
4. Si el ERP real no puede producir alguna columna exactamente así (por
   ejemplo, sus propios códigos de producto en vez de los canónicos), el
   archivo `catalogo_correspondencias.csv` es precisamente el mecanismo para
   traducir "código del ERP" → "ID canónico de REVENUE", sin tocar el resto
   del pipeline.
