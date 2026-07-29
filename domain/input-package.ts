export type InputCriticality = "ESSENTIAL" | "CONDITIONAL";
export type InputReadiness = "NOT_RECEIVED" | "RECEIVED" | "INCOMPLETE" | "EXPIRED" | "READY";

export interface InputRequirement {
  id: string;
  name: string;
  purpose: string;
  criticality: InputCriticality;
  minimumCoverage: string;
  expectedGrain: string;
  suggestedOwner: string;
  requiredFields: readonly string[];
}

export interface InputPackageItem {
  requirementId: string;
  status: InputReadiness;
  sourceName?: string;
  responsible?: string;
  limitation?: string;
}

export interface InputPackage {
  contractVersion: "REVENUE-PILOT-V1";
  planId: string;
  items: InputPackageItem[];
}

export const PILOT_INPUT_REQUIREMENTS: readonly InputRequirement[] = [
  {
    id: "sales-history",
    name: "Historia de ventas",
    purpose: "Sustentar el comportamiento recurrente y calcular el baseline.",
    criticality: "ESSENTIAL",
    minimumCoverage: "Al menos 12 meses; mayor historia mejora el método disponible.",
    expectedGrain: "Cuenta × SKU × periodo, con unidades y valor identificables.",
    suggestedOwner: "Ventas y Finanzas Comercial",
    requiredFields: ["account_id", "sku_id", "period", "units", "value", "currency"],
  },
  {
    id: "account-product-mapping",
    name: "Catálogo y correspondencias",
    purpose: "Reconocer sin ambigüedad la cuenta y cada producto.",
    criticality: "ESSENTIAL",
    minimumCoverage: "Todos los códigos presentes en la historia del piloto.",
    expectedGrain: "Código fuente ↔ cuenta o SKU canónico.",
    suggestedOwner: "Datos Maestros",
    requiredFields: ["source_type", "source_code", "canonical_id", "canonical_name"],
  },
  {
    id: "unit-conversions",
    name: "Unidades y conversiones",
    purpose: "Expresar y reconciliar unidades base, cajas u otras presentaciones.",
    criticality: "ESSENTIAL",
    minimumCoverage: "Todos los SKU y unidades utilizados en el Plan.",
    expectedGrain: "SKU × unidad de origen × unidad base × factor vigente.",
    suggestedOwner: "Operaciones o Supply",
    requiredFields: ["sku_id", "source_unit", "base_unit", "conversion_factor"],
  },
  {
    id: "prices-currency",
    name: "Precios y moneda",
    purpose: "Convertir unidades a valor sin promedios ni supuestos silenciosos.",
    criticality: "ESSENTIAL",
    minimumCoverage: "Cuenta, SKU y periodos que cubrirá el Plan.",
    expectedGrain: "Cuenta × SKU × periodo de vigencia, precio, moneda y tipo.",
    suggestedOwner: "Finanzas Comercial",
    requiredFields: ["account_id", "sku_id", "valid_from", "price", "currency", "price_type"],
  },
  {
    id: "activity-history",
    name: "Historia de promociones y actividades",
    purpose: "Separar intervenciones del baseline y evitar doble conteo.",
    criticality: "CONDITIONAL",
    minimumCoverage: "Periodos históricos con actividad conocida.",
    expectedGrain: "Actividad × cuenta × SKU × periodo, con tipo y alcance.",
    suggestedOwner: "Marketing y Trade Marketing",
    requiredFields: ["activity_id", "activity_type", "account_id", "sku_id", "start_period", "end_period"],
  },
  {
    id: "marketing-plan",
    name: "Plan anual de Marketing",
    purpose: "Incorporar eventos de Marketing y asignar a la cuenta su parte del crecimiento.",
    criticality: "CONDITIONAL",
    minimumCoverage: "Actividades del año del Plan con fechas, volumen corporativo y participación de la cuenta.",
    expectedGrain: "Actividad × cuenta × SKU, con periodo, volumen, asignación y ajustes incrementales.",
    suggestedOwner: "Marketing",
    requiredFields: ["activity_id","activity_name","account_id","sku_id","start_period","end_period","corporate_gross_units","allocation_share","cannibalization_units","halo_units","pull_forward_units","interaction_units","evidence"],
  },
  {
    id: "trade-marketing-plan",
    name: "Plan anual de Trade Marketing",
    purpose: "Incorporar promociones y ejecuciones comerciales con su incremental neto por cuenta.",
    criticality: "CONDITIONAL",
    minimumCoverage: "Actividades del año del Plan con fechas, volumen corporativo y participación de la cuenta.",
    expectedGrain: "Actividad × cuenta × SKU, con periodo, volumen, asignación y ajustes incrementales.",
    suggestedOwner: "Trade Marketing",
    requiredFields: ["activity_id","activity_name","account_id","sku_id","start_period","end_period","corporate_gross_units","allocation_share","cannibalization_units","halo_units","pull_forward_units","interaction_units","evidence"],
  },
  {
    id: "commercial-conditions",
    name: "Condiciones comerciales",
    purpose: "Convertir GSV en NSV con los descuentos y deducciones pactados para la cuenta.",
    criticality: "CONDITIONAL",
    minimumCoverage: "Cuenta, SKU y vigencias del año del Plan.",
    expectedGrain: "Cuenta × SKU × vigencia, con tasas y evidencia aprobada.",
    suggestedOwner: "Finanzas Comercial y Ventas",
    requiredFields: ["account_id","sku_id","valid_from","discount_rate","rebate_rate","returns_rate","other_deduction_rate","evidence"],
  },
  {
    id: "product-costs",
    name: "Costos por producto",
    purpose: "Calcular COGS y margen con costo vigente por SKU.",
    criticality: "CONDITIONAL",
    minimumCoverage: "Todos los SKU y vigencias del año del Plan.",
    expectedGrain: "SKU × vigencia, con costo unitario y moneda.",
    suggestedOwner: "Finanzas",
    requiredFields: ["sku_id","valid_from","unit_cost","currency","evidence"],
  },
  {
    id: "activity-investments",
    name: "Inversión de actividades",
    purpose: "Restar la inversión aprobada de Marketing y Trade Marketing para calcular contribución.",
    criticality: "CONDITIONAL",
    minimumCoverage: "Todas las actividades incorporadas al Crecimiento.",
    expectedGrain: "Actividad × cuenta × SKU × periodo, con inversión y moneda.",
    suggestedOwner: "Marketing y Trade Marketing",
    requiredFields: ["activity_id","account_id","sku_id","period","investment_value","currency","evidence"],
  },
  { id:"sales-quota", name:"Cuota comercial", purpose:"Comparar el Plan y el desempeño contra la cuota autorizada.", criticality:"CONDITIONAL", minimumCoverage:"Los 12 meses del año del Plan para cada cuenta o SKU aplicable.", expectedGrain:"Cuenta × SKU × mes, con cuota en unidades o valor y moneda identificados.", suggestedOwner:"Dirección Comercial", requiredFields:["account_id","sku_id","period","quota_value","currency"] },
  { id:"actual-sales", name:"Ventas actuales", purpose:"Monitorear avance, cobertura y variaciones con fecha de corte.", criticality:"CONDITIONAL", minimumCoverage:"Desde enero hasta el último corte confiable del año del Plan.", expectedGrain:"Cuenta × SKU × periodo × corte, con unidades y valor observados.", suggestedOwner:"Ventas y Finanzas Comercial", requiredFields:["account_id","sku_id","period","cutoff_date","actual_units","actual_value","currency"] },
] as const;

export function createEmptyInputPackage(planId: string): InputPackage {
  return {
    contractVersion: "REVENUE-PILOT-V1",
    planId,
    items: PILOT_INPUT_REQUIREMENTS.map((requirement) => ({
      requirementId: requirement.id,
      status: "NOT_RECEIVED",
    })),
  };
}

export function canCalculateBaseline(inputPackage: InputPackage): boolean {
  return PILOT_INPUT_REQUIREMENTS
    .filter((requirement) => requirement.criticality === "ESSENTIAL")
    .every((requirement) =>
      inputPackage.items.some(
        (item) => item.requirementId === requirement.id && item.status === "READY",
      ),
    );
}

export interface HeaderValidation {
  status: "READY" | "INCOMPLETE";
  normalizedHeaders: string[];
  missingFields: string[];
}

export interface InputValidationIssue {
  code: string;
  message: string;
  rows?: number[];
}

export interface InputContentSummary {
  rowCount: number;
  accountIds: string[];
  skuIds: string[];
  periods: string[];
}

export interface InputContentValidation {
  status: "READY" | "INCOMPLETE";
  issues: InputValidationIssue[];
  summary: InputContentSummary;
}

export interface PackageSummary {
  requirementId: string;
  status: string;
  summary: InputContentSummary;
}

export function validateCsvHeaders(
  requirementId: string,
  headers: readonly string[],
): HeaderValidation {
  const requirement = PILOT_INPUT_REQUIREMENTS.find((item) => item.id === requirementId);
  if (!requirement) throw new Error("Requisito de información no reconocido");
  const normalizedHeaders = headers.map((header) =>
    header.trim().toLowerCase().replace(/[\s-]+/g, "_"),
  );
  const missingFields = requirement.requiredFields.filter(
    (field) => !normalizedHeaders.includes(field),
  );
  return {
    status: missingFields.length === 0 ? "READY" : "INCOMPLETE",
    normalizedHeaders,
    missingFields,
  };
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = firstLine.includes(";") && !firstLine.includes(",") ? ";" : ",";
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      row.push(value.trim());
      value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(value.trim());
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }
  row.push(value.trim());
  if (row.some((cell) => cell !== "")) rows.push(row);
  return rows;
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort();
}

export function validateCsvContent(
  requirementId: string,
  csvText: string,
): InputContentValidation {
  const rows = parseCsv(csvText.replace(/^\uFEFF/, ""));
  if (rows.length < 2) {
    return {
      status: "INCOMPLETE",
      issues: [{ code: "NO_DATA", message: "El archivo no contiene filas de información." }],
      summary: { rowCount: 0, accountIds: [], skuIds: [], periods: [] },
    };
  }
  const headers = rows[0].map((header) =>
    header.trim().toLowerCase().replace(/[\s-]+/g, "_"),
  );
  const headerValidation = validateCsvHeaders(requirementId, headers);
  const issues: InputValidationIssue[] = headerValidation.missingFields.length
    ? [{
        code: "MISSING_FIELDS",
        message: `Faltan columnas: ${headerValidation.missingFields.join(", ")}.`,
      }]
    : [];
  if (headerValidation.missingFields.length) {
    return {
      status: "INCOMPLETE",
      issues,
      summary: { rowCount: rows.length - 1, accountIds: [], skuIds: [], periods: [] },
    };
  }

  const records = rows.slice(1).map((cells, rowIndex) => ({
    rowNumber: rowIndex + 2,
    values: Object.fromEntries(headers.map((header, index) => [header, cells[index]?.trim() ?? ""])),
  }));
  const requirement = PILOT_INPUT_REQUIREMENTS.find((item) => item.id === requirementId)!;
  const emptyRows = records
    .filter((record) => requirement.requiredFields.some((field) => !record.values[field]))
    .map((record) => record.rowNumber);
  if (emptyRows.length) {
    issues.push({
      code: "EMPTY_REQUIRED_VALUES",
      message: "Hay filas con información obligatoria vacía.",
      rows: emptyRows.slice(0, 20),
    });
  }

  const numericFieldsByRequirement: Record<string, string[]> = {
    "sales-history": ["units", "value"],
    "unit-conversions": ["conversion_factor"],
    "prices-currency": ["price"],
    "sales-quota": ["quota_value"],
    "actual-sales": ["actual_units","actual_value"],
    "commercial-conditions": ["discount_rate","rebate_rate","returns_rate","other_deduction_rate"],
    "product-costs": ["unit_cost"],
    "activity-investments": ["investment_value"],
  };
  const invalidNumericRows = records
    .filter((record) =>
      (numericFieldsByRequirement[requirementId] ?? []).some((field) => {
        const value = Number(record.values[field]);
        return !Number.isFinite(value) || value < 0;
      }),
    )
    .map((record) => record.rowNumber);
  if (invalidNumericRows.length) {
    issues.push({
      code: "INVALID_NUMBERS",
      message: "Hay cantidades, factores o precios que no son números válidos no negativos.",
      rows: invalidNumericRows.slice(0, 20),
    });
  }

  const currencyRows = records
    .filter((record) => "currency" in record.values && !/^[A-Za-z]{3}$/.test(record.values.currency))
    .map((record) => record.rowNumber);
  if (currencyRows.length) {
    issues.push({
      code: "INVALID_CURRENCY",
      message: "La moneda debe usar un código de tres letras, por ejemplo MXN o USD.",
      rows: currencyRows.slice(0, 20),
    });
  }

  const periodFields = ["period", "valid_from", "start_period", "end_period"];
  const invalidPeriodRows = records
    .filter((record) =>
      periodFields.some(
        (field) => field in record.values && !/^\d{4}-(0[1-9]|1[0-2])(?:-\d{2})?$/.test(record.values[field]),
      ),
    )
    .map((record) => record.rowNumber);
  if (invalidPeriodRows.length) {
    issues.push({
      code: "INVALID_PERIOD",
      message: "Los periodos deben usar AAAA-MM o AAAA-MM-DD.",
      rows: invalidPeriodRows.slice(0, 20),
    });
  }

  const keyFieldsByRequirement: Record<string, string[]> = {
    "sales-history": ["account_id", "sku_id", "period"],
    "account-product-mapping": ["source_type", "source_code"],
    "unit-conversions": ["sku_id", "source_unit", "base_unit"],
    "prices-currency": ["account_id", "sku_id", "valid_from", "price_type"],
    "activity-history": ["activity_id", "account_id", "sku_id", "start_period", "end_period"],
    "sales-quota": ["account_id","sku_id","period"],
    "actual-sales": ["account_id","sku_id","period","cutoff_date"],
    "commercial-conditions": ["account_id","sku_id","valid_from"],
    "product-costs": ["sku_id","valid_from"],
    "activity-investments": ["activity_id","account_id","sku_id","period"],
  };
  const seen = new Map<string, number>();
  const duplicateRows: number[] = [];
  for (const record of records) {
    const key = (keyFieldsByRequirement[requirementId] ?? []).map((field) => record.values[field]).join("|");
    if (seen.has(key)) duplicateRows.push(record.rowNumber);
    else seen.set(key, record.rowNumber);
  }
  if (duplicateRows.length) {
    issues.push({
      code: "DUPLICATE_GRAIN",
      message: "Hay filas duplicadas para el nivel de detalle esperado.",
      rows: duplicateRows.slice(0, 20),
    });
  }

  const mappedAccounts = requirementId === "account-product-mapping"
    ? records
        .filter((record) => /account|customer|cuenta|cliente/i.test(record.values.source_type))
        .map((record) => record.values.canonical_id)
    : [];
  const mappedSkus = requirementId === "account-product-mapping"
    ? records
        .filter((record) => /sku|product|producto/i.test(record.values.source_type))
        .map((record) => record.values.canonical_id)
    : [];
  const summary = {
    rowCount: records.length,
    accountIds: unique([
      ...records.map((record) => record.values.account_id),
      ...mappedAccounts,
    ]),
    skuIds: unique([
      ...records.map((record) => record.values.sku_id),
      ...mappedSkus,
    ]),
    periods: unique(records.map((record) =>
      record.values.period ?? record.values.valid_from ?? record.values.start_period,
    )),
  };
  if (requirementId === "sales-history" && summary.periods.length < 12) {
    issues.push({
      code: "INSUFFICIENT_HISTORY",
      message: `La historia contiene ${summary.periods.length} periodos distintos; se requieren al menos 12.`,
    });
  }
  return { status: issues.length ? "INCOMPLETE" : "READY", issues, summary };
}

export function validatePackageCorrespondence(files: readonly PackageSummary[]): InputValidationIssue[] {
  const byRequirement = new Map(files.map((file) => [file.requirementId, file]));
  const sales = byRequirement.get("sales-history");
  if (!sales || sales.status !== "READY") return [];
  const issues: InputValidationIssue[] = [];
  const compare = (
    requirementId: string,
    label: string,
    salesValues: string[],
    candidateValues: (summary: InputContentSummary) => string[],
  ) => {
    const candidate = byRequirement.get(requirementId);
    if (!candidate || candidate.status !== "READY") return;
    const available = new Set(candidateValues(candidate.summary));
    const missing = salesValues.filter((value) => !available.has(value));
    if (missing.length) {
      issues.push({
        code: `UNMATCHED_${requirementId.toUpperCase().replace(/-/g, "_")}`,
        message: `${label}: ${missing.slice(0, 10).join(", ")}${missing.length > 10 ? "…" : ""}.`,
      });
    }
  };
  compare(
    "account-product-mapping",
    "Códigos de venta sin correspondencia en el catálogo",
    [...sales.summary.accountIds, ...sales.summary.skuIds],
    (summary) => [...summary.accountIds, ...summary.skuIds],
  );
  compare(
    "unit-conversions",
    "SKU de venta sin conversión",
    sales.summary.skuIds,
    (summary) => summary.skuIds,
  );
  compare(
    "prices-currency",
    "SKU de venta sin precio",
    sales.summary.skuIds,
    (summary) => summary.skuIds,
  );
  return issues;
}

export function canAcceptInputPackage(
  files: readonly PackageSummary[],
  packageIssues: readonly InputValidationIssue[],
): boolean {
  const essentialIds = PILOT_INPUT_REQUIREMENTS
    .filter((requirement) => requirement.criticality === "ESSENTIAL")
    .map((requirement) => requirement.id);
  return (
    essentialIds.every((requirementId) =>
      files.some((file) => file.requirementId === requirementId && file.status === "READY"),
    ) && packageIssues.length === 0
  );
}
