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
