export const SALES_FIELDS = [
  "account_id",
  "sku_id",
  "period",
  "units",
  "value",
  "currency",
] as const;

export type SalesField = typeof SALES_FIELDS[number];
export type WorkbookCell = string | number | boolean | Date | null | undefined;
export type WorkbookSheet = { name: string; rows: WorkbookCell[][] };

export type CanonicalSalesRow = {
  account_id: string;
  sku_id: string;
  period: string;
  units: number;
  value: number;
  currency: string;
  source_sheet: string;
  source_row: number;
};

export type SalesWorkbookAnalysis = {
  status: "READY" | "INCOMPLETE";
  selectedSheet: string | null;
  sheetNames: string[];
  headerRow: number | null;
  sourceHeaders: string[];
  mapping: Partial<Record<SalesField, string>>;
  confidence: number;
  issues: Array<{ code: string; message: string; rows?: number[] }>;
  summary: {
    rowCount: number;
    validRowCount: number;
    rejectedRowCount: number;
    coverageMonths: number;
    accountIds: string[];
    skuIds: string[];
    periods: string[];
    currencies: string[];
  };
  canonicalRows: CanonicalSalesRow[];
};

export const ACTIVITY_FIELDS = [
  "activity_id", "activity_name", "account_id", "sku_id", "start_period", "end_period",
  "corporate_gross_units", "allocation_share", "cannibalization_units", "halo_units",
  "pull_forward_units", "interaction_units", "evidence",
] as const;
export type ActivityField = typeof ACTIVITY_FIELDS[number];
export type ActivityFamily = "MARKETING" | "TRADE_MARKETING";
export type CanonicalGrowthActivity = {
  id: string;
  family: ActivityFamily;
  name: string;
  accountId: string;
  skuId: string;
  period: string;
  startPeriod: string;
  endPeriod: string;
  corporateGrossUnits: number;
  allocationShare: number;
  grossUnits: number;
  cannibalizationUnits: number;
  haloUnits: number;
  pullForwardUnits: number;
  interactionUnits: number;
  evidence: string;
  source_sheet: string;
  source_row: number;
};
export type ActivityWorkbookAnalysis = {
  status: "READY" | "INCOMPLETE";
  selectedSheet: string | null;
  sheetNames: string[];
  headerRow: number | null;
  sourceHeaders: string[];
  mapping: Partial<Record<ActivityField, string>>;
  confidence: number;
  issues: Array<{ code: string; message: string; rows?: number[] }>;
  summary: {
    rowCount: number; validRowCount: number; rejectedRowCount: number;
    accountIds: string[]; skuIds: string[]; periods: string[]; allocatedUnits: number;
  };
  canonicalRows: CanonicalGrowthActivity[];
};

const aliases: Record<SalesField, string[]> = {
  account_id: [
    "account id", "account", "account code", "customer id", "customer code",
    "customer", "cuenta", "codigo cuenta", "id cuenta", "cliente",
    "codigo cliente", "id cliente",
  ],
  sku_id: [
    "sku id", "sku", "item id", "item", "product id", "product code",
    "producto", "codigo producto", "id producto", "material", "codigo material",
  ],
  period: [
    "period", "month", "date", "invoice date", "sales month", "periodo", "mes",
    "fecha", "fecha venta", "ano mes", "year month",
  ],
  units: [
    "units", "unit sales", "quantity", "qty", "volume", "unidades",
    "cantidad", "volumen", "piezas",
  ],
  value: [
    "value", "sales value", "gross sales", "revenue", "amount", "importe",
    "valor", "venta", "ventas", "venta bruta", "gsv",
  ],
  currency: [
    "currency", "currency code", "moneda", "codigo moneda", "divisa",
  ],
};

const activityAliases: Record<ActivityField, string[]> = {
  activity_id: ["activity id", "id actividad", "codigo actividad", "event id", "id evento"],
  activity_name: ["activity name", "actividad", "nombre actividad", "event name", "evento", "nombre evento"],
  account_id: aliases.account_id,
  sku_id: aliases.sku_id,
  start_period: ["start period", "start date", "inicio", "periodo inicio", "fecha inicio", "mes inicio"],
  end_period: ["end period", "end date", "fin", "periodo fin", "fecha fin", "mes fin"],
  corporate_gross_units: [
    "corporate gross units", "gross units", "unidades brutas corporativas",
    "unidades corporativas", "volumen corporativo", "unidades brutas",
  ],
  allocation_share: [
    "allocation share", "account share", "share of business", "participacion cuenta",
    "share cuenta", "porcentaje asignacion", "asignacion cuenta",
  ],
  cannibalization_units: ["cannibalization units", "cannibalization", "canibalizacion", "unidades canibalizacion"],
  halo_units: ["halo units", "halo", "efecto halo", "unidades halo"],
  pull_forward_units: ["pull forward units", "pull forward", "compra anticipada", "unidades anticipadas"],
  interaction_units: ["interaction units", "interaction", "interaccion", "unidades interaccion"],
  evidence: ["evidence", "source", "support", "evidencia", "fuente", "soporte", "referencia"],
};

function normalized(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_./\\-]+/g, " ")
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function fieldForHeader(header: unknown): SalesField | undefined {
  const candidate = normalized(header);
  return SALES_FIELDS.find((field) =>
    aliases[field].some((alias) => candidate === normalized(alias)),
  );
}

function findHeader(rows: WorkbookCell[][]) {
  let best: { index: number; score: number; mapping: Partial<Record<SalesField, number>> } | null = null;
  rows.slice(0, 30).forEach((row, index) => {
    const mapping: Partial<Record<SalesField, number>> = {};
    row.forEach((cell, column) => {
      const field = fieldForHeader(cell);
      if (field && mapping[field] === undefined) mapping[field] = column;
    });
    const score = Object.keys(mapping).length;
    if (!best || score > best.score) best = { index, score, mapping };
  });
  return best;
}

function activityFieldForHeader(header: unknown): ActivityField | undefined {
  const candidate = normalized(header);
  return ACTIVITY_FIELDS.find((field) =>
    activityAliases[field].some((alias) => candidate === normalized(alias)),
  );
}

function findActivityHeader(rows: WorkbookCell[][]) {
  let best: { index: number; score: number; mapping: Partial<Record<ActivityField, number>> } | null = null;
  rows.slice(0, 30).forEach((row, index) => {
    const mapping: Partial<Record<ActivityField, number>> = {};
    row.forEach((cell, column) => {
      const field = activityFieldForHeader(cell);
      if (field && mapping[field] === undefined) mapping[field] = column;
    });
    const score = Object.keys(mapping).length;
    if (!best || score > best.score) best = { index, score, mapping };
  });
  return best;
}

function asText(value: WorkbookCell) {
  return String(value ?? "").trim();
}

function asNumber(value: WorkbookCell) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const compact = asText(value).replace(/\s/g, "");
  if (!compact) return null;
  const standardized = compact.includes(",") && compact.includes(".")
    ? compact.replace(/,/g, "")
    : compact.replace(",", ".");
  const result = Number(standardized.replace(/[$€£]/g, ""));
  return Number.isFinite(result) ? result : null;
}

function asPeriod(value: WorkbookCell) {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  if (typeof value === "number" && value > 20_000 && value < 80_000) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    epoch.setUTCDate(epoch.getUTCDate() + Math.floor(value));
    return `${epoch.getUTCFullYear()}-${String(epoch.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  const text = asText(value);
  const yearMonth = text.match(/\b(20\d{2})[-/ .](0?[1-9]|1[0-2])\b/);
  if (yearMonth) return `${yearMonth[1]}-${yearMonth[2].padStart(2, "0")}`;
  const monthYear = text.match(/\b(0?[1-9]|1[0-2])[-/ .](20\d{2})\b/);
  if (monthYear) return `${monthYear[2]}-${monthYear[1].padStart(2, "0")}`;
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.valueOf())) {
    return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  return null;
}

export function analyzeSalesWorkbook(sheets: WorkbookSheet[]): SalesWorkbookAnalysis {
  const candidates = sheets.map((sheet) => ({
    sheet,
    header: findHeader(sheet.rows),
  })).sort((a, b) => (b.header?.score ?? 0) - (a.header?.score ?? 0));
  const selected = candidates[0];
  const header = selected?.header;
  const mapping: Partial<Record<SalesField, string>> = {};
  const sourceHeaders = header
    ? selected.sheet.rows[header.index].map((value) => asText(value))
    : [];
  if (header) {
    for (const field of SALES_FIELDS) {
      const column = header.mapping[field];
      if (column !== undefined) mapping[field] = sourceHeaders[column] || `Columna ${column + 1}`;
    }
  }
  const issues: SalesWorkbookAnalysis["issues"] = [];
  const missing = SALES_FIELDS.filter((field) => !mapping[field]);
  if (!selected || !header || header.score < 3) {
    issues.push({
      code: "TABLE_NOT_FOUND",
      message: "No encontramos una tabla con encabezados suficientes para historia de ventas.",
    });
  } else if (missing.length) {
    issues.push({
      code: "MISSING_FIELDS",
      message: `Falta identificar: ${missing.join(", ")}.`,
    });
  }

  const canonicalRows: CanonicalSalesRow[] = [];
  const rejectedRows: number[] = [];
  if (selected && header && missing.length === 0) {
    const indexes = header.mapping as Record<SalesField, number>;
    selected.sheet.rows.slice(header.index + 1).forEach((row, offset) => {
      if (row.every((cell) => asText(cell) === "")) return;
      const sourceRow = header.index + offset + 2;
      const account = asText(row[indexes.account_id]);
      const sku = asText(row[indexes.sku_id]);
      const period = asPeriod(row[indexes.period]);
      const units = asNumber(row[indexes.units]);
      const value = asNumber(row[indexes.value]);
      const currency = asText(row[indexes.currency]).toUpperCase();
      if (!account || !sku || !period || units === null || value === null || !/^[A-Z]{3}$/.test(currency)) {
        rejectedRows.push(sourceRow);
        return;
      }
      canonicalRows.push({
        account_id: account,
        sku_id: sku,
        period,
        units,
        value,
        currency,
        source_sheet: selected.sheet.name,
        source_row: sourceRow,
      });
    });
  }
  if (rejectedRows.length) {
    issues.push({
      code: "REJECTED_ROWS",
      message: `${rejectedRows.length} filas no pudieron convertirse por valores faltantes o inválidos.`,
      rows: rejectedRows.slice(0, 20),
    });
  }
  const periods = [...new Set(canonicalRows.map((row) => row.period))].sort();
  if (canonicalRows.length > 0 && periods.length < 12) {
    issues.push({
      code: "INSUFFICIENT_COVERAGE",
      message: `La historia contiene ${periods.length} meses; se requieren al menos 12.`,
    });
  }
  if (canonicalRows.length === 0 && !issues.some((issue) => issue.code === "TABLE_NOT_FOUND")) {
    issues.push({
      code: "NO_VALID_ROWS",
      message: "La tabla fue localizada, pero ninguna fila pudo convertirse.",
    });
  }
  const rowCount = selected && header ? selected.sheet.rows.slice(header.index + 1)
    .filter((row) => row.some((cell) => asText(cell) !== "")).length : 0;
  const blockingCodes = new Set(["TABLE_NOT_FOUND", "MISSING_FIELDS", "NO_VALID_ROWS", "INSUFFICIENT_COVERAGE"]);
  return {
    status: issues.some((issue) => blockingCodes.has(issue.code)) ? "INCOMPLETE" : "READY",
    selectedSheet: selected?.sheet.name ?? null,
    sheetNames: sheets.map((sheet) => sheet.name),
    headerRow: header ? header.index + 1 : null,
    sourceHeaders,
    mapping,
    confidence: header ? Math.round((header.score / SALES_FIELDS.length) * 100) : 0,
    issues,
    summary: {
      rowCount,
      validRowCount: canonicalRows.length,
      rejectedRowCount: rejectedRows.length,
      coverageMonths: periods.length,
      accountIds: [...new Set(canonicalRows.map((row) => row.account_id))].sort(),
      skuIds: [...new Set(canonicalRows.map((row) => row.sku_id))].sort(),
      periods,
      currencies: [...new Set(canonicalRows.map((row) => row.currency))].sort(),
    },
    canonicalRows,
  };
}

export function analyzeActivityWorkbook(
  sheets: WorkbookSheet[],
  family: ActivityFamily,
): ActivityWorkbookAnalysis {
  const candidates = sheets.map((sheet) => ({ sheet, header: findActivityHeader(sheet.rows) }))
    .sort((a, b) => (b.header?.score ?? 0) - (a.header?.score ?? 0));
  const selected = candidates[0];
  const header = selected?.header;
  const sourceHeaders = header ? selected.sheet.rows[header.index].map(asText) : [];
  const mapping: Partial<Record<ActivityField, string>> = {};
  if (header) for (const field of ACTIVITY_FIELDS) {
    const column = header.mapping[field];
    if (column !== undefined) mapping[field] = sourceHeaders[column] || `Columna ${column + 1}`;
  }
  const issues: ActivityWorkbookAnalysis["issues"] = [];
  const missing = ACTIVITY_FIELDS.filter((field) => !mapping[field]);
  if (!selected || !header || header.score < 5) {
    issues.push({ code: "TABLE_NOT_FOUND", message: "No encontramos una tabla de actividades reconocible." });
  } else if (missing.length) {
    issues.push({ code: "MISSING_FIELDS", message: `Falta identificar: ${missing.join(", ")}.` });
  }
  const canonicalRows: CanonicalGrowthActivity[] = [];
  const rejectedRows: number[] = [];
  if (selected && header && missing.length === 0) {
    const indexes = header.mapping as Record<ActivityField, number>;
    selected.sheet.rows.slice(header.index + 1).forEach((row, offset) => {
      if (row.every((cell) => asText(cell) === "")) return;
      const sourceRow = header.index + offset + 2;
      const id = asText(row[indexes.activity_id]);
      const name = asText(row[indexes.activity_name]);
      const accountId = asText(row[indexes.account_id]);
      const skuId = asText(row[indexes.sku_id]);
      const startPeriod = asPeriod(row[indexes.start_period]);
      const endPeriod = asPeriod(row[indexes.end_period]);
      const corporateGrossUnits = asNumber(row[indexes.corporate_gross_units]);
      const rawShare = asNumber(row[indexes.allocation_share]);
      const allocationShare = rawShare !== null && rawShare > 1 && rawShare <= 100 ? rawShare / 100 : rawShare;
      const cannibalizationUnits = asNumber(row[indexes.cannibalization_units]);
      const haloUnits = asNumber(row[indexes.halo_units]);
      const pullForwardUnits = asNumber(row[indexes.pull_forward_units]);
      const interactionUnits = asNumber(row[indexes.interaction_units]);
      const evidence = asText(row[indexes.evidence]);
      const numbers = [corporateGrossUnits, allocationShare, cannibalizationUnits, haloUnits, pullForwardUnits, interactionUnits];
      if (!id || !name || !accountId || !skuId || !startPeriod || !endPeriod || !evidence
        || numbers.some((value) => value === null)
        || corporateGrossUnits! < 0 || allocationShare! < 0 || allocationShare! > 1
        || cannibalizationUnits! < 0 || haloUnits! < 0 || pullForwardUnits! < 0) {
        rejectedRows.push(sourceRow);
        return;
      }
      canonicalRows.push({
        id, family, name, accountId, skuId, period: startPeriod, startPeriod, endPeriod,
        corporateGrossUnits: corporateGrossUnits!, allocationShare: allocationShare!,
        grossUnits: corporateGrossUnits! * allocationShare!,
        cannibalizationUnits: cannibalizationUnits!, haloUnits: haloUnits!,
        pullForwardUnits: pullForwardUnits!, interactionUnits: interactionUnits!,
        evidence, source_sheet: selected.sheet.name, source_row: sourceRow,
      });
    });
  }
  if (rejectedRows.length) {
    issues.push({
      code: "REJECTED_ROWS",
      message: `${rejectedRows.length} filas tienen fechas, asignaciones o cantidades inválidas.`,
      rows: rejectedRows.slice(0, 20),
    });
  }
  if (!canonicalRows.length && !issues.some((issue) => issue.code === "TABLE_NOT_FOUND")) {
    issues.push({ code: "NO_VALID_ROWS", message: "La tabla fue localizada, pero ninguna actividad pudo convertirse." });
  }
  const rowCount = selected && header ? selected.sheet.rows.slice(header.index + 1)
    .filter((row) => row.some((cell) => asText(cell) !== "")).length : 0;
  const periods = [...new Set(canonicalRows.flatMap((row) => [row.startPeriod, row.endPeriod]))].sort();
  const blockingCodes = new Set(["TABLE_NOT_FOUND", "MISSING_FIELDS", "NO_VALID_ROWS"]);
  return {
    status: issues.some((issue) => blockingCodes.has(issue.code)) ? "INCOMPLETE" : "READY",
    selectedSheet: selected?.sheet.name ?? null,
    sheetNames: sheets.map((sheet) => sheet.name),
    headerRow: header ? header.index + 1 : null,
    sourceHeaders, mapping,
    confidence: header ? Math.round((header.score / ACTIVITY_FIELDS.length) * 100) : 0,
    issues,
    summary: {
      rowCount, validRowCount: canonicalRows.length, rejectedRowCount: rejectedRows.length,
      accountIds: [...new Set(canonicalRows.map((row) => row.accountId))].sort(),
      skuIds: [...new Set(canonicalRows.map((row) => row.skuId))].sort(),
      periods,
      allocatedUnits: canonicalRows.reduce((sum, row) => sum + row.grossUnits, 0),
    },
    canonicalRows,
  };
}

const FINANCIAL_FIELDS = {
  "commercial-conditions": ["account_id","sku_id","valid_from","discount_rate","rebate_rate","returns_rate","other_deduction_rate","evidence"],
  "product-costs": ["sku_id","valid_from","unit_cost","currency","evidence"],
  "activity-investments": ["activity_id","account_id","sku_id","period","investment_value","currency","evidence"],
} as const;
export type FinancialRequirement = keyof typeof FINANCIAL_FIELDS;

const financialAliases: Record<string, string[]> = {
  account_id: ["account id","cuenta","id cuenta","cliente"],
  sku_id: ["sku id","sku","producto","codigo producto"],
  valid_from: ["valid from","vigente desde","vigencia","fecha vigencia"],
  discount_rate: ["discount rate","descuento","tasa descuento"],
  rebate_rate: ["rebate rate","rebate","tasa rebate","bonificacion"],
  returns_rate: ["returns rate","devoluciones","tasa devoluciones"],
  other_deduction_rate: ["other deduction rate","otras deducciones","tasa otras deducciones"],
  evidence: ["evidence","evidencia","fuente","soporte"],
  unit_cost: ["unit cost","costo unitario","costo por unidad"],
  currency: ["currency","moneda","divisa"],
  activity_id: ["activity id","id actividad","codigo actividad"],
  period: ["period","periodo","mes"],
  investment_value: ["investment value","inversion","valor inversion","inversion aprobada"],
};

export function analyzeFinancialWorkbook(sheets: WorkbookSheet[], requirement: FinancialRequirement) {
  const fields = [...FINANCIAL_FIELDS[requirement]];
  const candidates = sheets.map((sheet) => {
    let best: { index: number; score: number; indexes: Record<string, number> } | null = null;
    sheet.rows.slice(0, 30).forEach((row, index) => {
      const indexes: Record<string, number> = {};
      row.forEach((cell, column) => {
        const header = normalized(cell);
        const field = fields.find((name) => financialAliases[name].some((alias) => normalized(alias) === header));
        if (field && indexes[field] === undefined) indexes[field] = column;
      });
      const score = Object.keys(indexes).length;
      if (!best || score > best.score) best = { index, score, indexes };
    });
    return { sheet, header: best };
  }).sort((a,b) => (b.header?.score ?? 0) - (a.header?.score ?? 0));
  const selected = candidates[0];
  const header = selected?.header;
  const sourceHeaders = header ? selected.sheet.rows[header.index].map(asText) : [];
  const mapping: Record<string,string> = {};
  if (header) fields.forEach((field) => {
    const column = header.indexes[field];
    if (column !== undefined) mapping[field] = sourceHeaders[column] || `Columna ${column + 1}`;
  });
  const missing = fields.filter((field) => !mapping[field]);
  const issues: Array<{code:string;message:string;rows?:number[]}> = [];
  if (!header || header.score < 3) issues.push({code:"TABLE_NOT_FOUND",message:"No encontramos una tabla financiera reconocible."});
  else if (missing.length) issues.push({code:"MISSING_FIELDS",message:`Falta identificar: ${missing.join(", ")}.`});
  const canonicalRows: Array<Record<string,string|number>> = [];
  const rejectedRows: number[] = [];
  if (selected && header && !missing.length) {
    selected.sheet.rows.slice(header.index + 1).forEach((row, offset) => {
      if (row.every((cell) => asText(cell) === "")) return;
      const record: Record<string,string|number> = {};
      let valid = true;
      for (const field of fields) {
        const cell = row[header.indexes[field]];
        if (field.endsWith("_rate") || field === "unit_cost" || field === "investment_value") {
          let value = asNumber(cell);
          if (value === null || value < 0) valid = false;
          if (field.endsWith("_rate") && value !== null && value > 1 && value <= 100) value /= 100;
          if (field.endsWith("_rate") && value !== null && value > 1) valid = false;
          record[field] = value ?? 0;
        } else if (field === "valid_from" || field === "period") {
          const value = asPeriod(cell);
          if (!value) valid = false;
          record[field] = value ?? "";
        } else {
          const value = asText(cell);
          if (!value) valid = false;
          record[field] = field === "currency" ? value.toUpperCase() : value;
        }
      }
      if (requirement === "commercial-conditions") {
        const total = ["discount_rate","rebate_rate","returns_rate","other_deduction_rate"]
          .reduce((sum, field) => sum + Number(record[field]), 0);
        if (total > 1) valid = false;
      }
      if (!valid) rejectedRows.push(header.index + offset + 2);
      else canonicalRows.push(record);
    });
  }
  if (rejectedRows.length) issues.push({code:"REJECTED_ROWS",message:`${rejectedRows.length} filas tienen valores inválidos.`,rows:rejectedRows.slice(0,20)});
  if (!canonicalRows.length && header && !missing.length) issues.push({code:"NO_VALID_ROWS",message:"No fue posible convertir ninguna fila."});
  const periods = [...new Set(canonicalRows.map((row) => String(row.valid_from ?? row.period ?? "")))].sort();
  return {
    status: issues.some((issue) => ["TABLE_NOT_FOUND","MISSING_FIELDS","NO_VALID_ROWS"].includes(issue.code)) ? "INCOMPLETE" as const : "READY" as const,
    selectedSheet:selected?.sheet.name ?? null, sheetNames:sheets.map((sheet)=>sheet.name),
    headerRow:header ? header.index + 1 : null, sourceHeaders, mapping,
    confidence:header ? Math.round((header.score / fields.length) * 100) : 0, issues,
    summary:{
      rowCount:canonicalRows.length + rejectedRows.length, validRowCount:canonicalRows.length,
      rejectedRowCount:rejectedRows.length,
      accountIds:[...new Set(canonicalRows.map((row)=>String(row.account_id ?? "")).filter(Boolean))].sort(),
      skuIds:[...new Set(canonicalRows.map((row)=>String(row.sku_id ?? "")).filter(Boolean))].sort(),
      periods, currencies:[...new Set(canonicalRows.map((row)=>String(row.currency ?? "")).filter(Boolean))].sort(),
    },
    canonicalRows,
  };
}
