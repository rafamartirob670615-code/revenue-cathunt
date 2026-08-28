import * as XLSX from "xlsx";
import {
  canAcceptInputPackage,
  PILOT_INPUT_REQUIREMENTS,
  validateCsvContent,
  validatePackageCorrespondence,
} from "../../../domain/input-package.ts";
import {
  analyzeSalesWorkbook,
  analyzeActivityWorkbook,
  analyzeFinancialWorkbook,
  type WorkbookCell,
} from "../../../domain/excel-intake.ts";
import { authorizePlan } from "../_access.ts";
import { database, files } from "../_infrastructure.ts";
import { requireAdmin } from "../_session.ts";

export const runtime = "nodejs";

function responseError(error: unknown) {
  const message = error instanceof Error ? error.message : "No pudimos recibir el archivo";
  const status = /Autenticación/.test(message) ? 401 : /no autorizado/.test(message) ? 403 : 422;
  return Response.json({ ok: false, error: message }, { status });
}

export async function GET(request: Request) {
  try {
    const planId = new URL(request.url).searchParams.get("planId");
    if (!planId) throw new Error("planId es obligatorio");
    const { dataOwnerId: ownerId } = await authorizePlan(request, planId);
    const result = await database()
      .prepare(
        "SELECT requirement_id, original_name, size_bytes, checksum, status, missing_fields_json, validation_json, summary_json, received_at FROM input_package_files WHERE plan_id = ? AND owner_id = ? ORDER BY received_at DESC",
      )
      .bind(planId, ownerId)
      .run<{
        requirement_id: string;
        original_name: string;
        size_bytes: number;
        checksum: string;
        status: string;
        missing_fields_json: string;
        validation_json: string;
        summary_json: string;
        received_at: string;
      }>();
    const rows = result.results ?? [];
    const packageIssues = validatePackageCorrespondence(rows.map((row) => ({
      requirementId: row.requirement_id,
      status: row.status,
      summary: JSON.parse(row.summary_json),
    })));
    const systemReady = canAcceptInputPackage(
      rows.map((row) => ({
        requirementId: row.requirement_id,
        status: row.status,
        summary: JSON.parse(row.summary_json),
      })),
      packageIssues,
    );
    const review = await database()
      .prepare(
        "SELECT status, accepted_at FROM input_package_reviews WHERE plan_id = ? AND owner_id = ?",
      )
      .bind(planId, ownerId)
      .first<{ status: string; accepted_at: string }>();
    return Response.json({
      ok: true,
      files: rows.map((row) => ({
        requirementId: row.requirement_id,
        originalName: row.original_name,
        sizeBytes: row.size_bytes,
        checksum: row.checksum,
        status: row.status,
        missingFields: JSON.parse(row.missing_fields_json),
        issues: JSON.parse(row.validation_json),
        summary: JSON.parse(row.summary_json),
        receivedAt: row.received_at,
        synthetic: row.original_name.startsWith("SINTETICO_V2_NO_COMERCIAL_") || row.original_name.startsWith("DATOS_SINTETICOS_NUBELIA_"),
      })),
      packageIssues,
      systemReady,
      accepted: review?.status === "ACCEPTED",
      acceptedAt: review?.accepted_at,
    });
  } catch (error) {
    return responseError(error);
  }
}

export async function POST(request: Request) {
  try {
    requireAdmin(request);
    const form = await request.formData();
    const planId = String(form.get("planId") ?? "");
    const requirementId = String(form.get("requirementId") ?? "");
    const file = form.get("file");
    if (!planId || !PILOT_INPUT_REQUIREMENTS.some((item) => item.id === requirementId)) {
      throw new Error("Plan o tipo de información no reconocido");
    }
    if (!(file instanceof File)) throw new Error("Selecciona un archivo Excel o CSV");
    const extension = file.name.toLowerCase().split(".").at(-1);
    const isExcel = extension === "xlsx" || extension === "xls";
    const isCsv = extension === "csv";
    if (!isExcel && !isCsv) {
      throw new Error("Utiliza un archivo Excel (.xlsx o .xls) o CSV.");
    }
    const financialRequirements = new Set(["commercial-conditions","product-costs","activity-investments","sales-quota","actual-sales"]);
    const intelligentExcelRequirements = new Set(["sales-history", "marketing-plan", "trade-marketing-plan", ...financialRequirements]);
    if (isExcel && !intelligentExcelRequirements.has(requirementId)) {
      throw new Error("Este insumo utiliza por ahora el formato CSV indicado.");
    }
    if (isCsv && (requirementId === "marketing-plan" || requirementId === "trade-marketing-plan" || financialRequirements.has(requirementId))) {
      throw new Error("Para este insumo, carga un Excel (.xlsx o .xls).");
    }
    if (file.size === 0 || file.size > 20_000_000) {
      throw new Error("El archivo debe contener información y pesar menos de 20 MB");
    }
    const uploadCapability = requirementId === "marketing-plan" ? "MARKETING_CONTRIBUTE"
      : requirementId === "trade-marketing-plan" ? "TRADE_CONTRIBUTE" : "PLAN_INTEGRATE";
    const { dataOwnerId: ownerId } = await authorizePlan(request, planId, [uploadCapability]);
    const bytes = await file.arrayBuffer();
    let status: "READY" | "INCOMPLETE";
    let issues: Array<{ code: string; message: string; rows?: number[] }>;
    let summary: Record<string, unknown>;
    let missingFields: string[];
    let canonicalPayload: string | null = null;
    let selectedSheet: string | null = null;
    let headerRow: number | null = null;
    let mapping: Record<string, string> = {};
    if (isExcel) {
      let workbook: XLSX.WorkBook;
      try {
        workbook = XLSX.read(bytes, {
          type: "array",
          cellDates: true,
          dense: true,
          sheetRows: 100_001,
        });
      } catch {
        throw new Error("No pudimos abrir el libro. Comprueba que sea un Excel válido y no esté protegido.");
      }
      const sheets = workbook.SheetNames.map((name) => ({
        name,
        rows: XLSX.utils.sheet_to_json<WorkbookCell[]>(workbook.Sheets[name], {
          header: 1,
          raw: true,
          defval: null,
          blankrows: false,
        }),
      }));
      const analysis = requirementId === "sales-history"
        ? analyzeSalesWorkbook(sheets)
        : financialRequirements.has(requirementId)
          ? analyzeFinancialWorkbook(sheets, requirementId as "commercial-conditions"|"product-costs"|"activity-investments"|"sales-quota"|"actual-sales")
          : analyzeActivityWorkbook(
            sheets,
            requirementId === "marketing-plan" ? "MARKETING" : "TRADE_MARKETING",
          );
      status = analysis.status;
      issues = analysis.issues;
      selectedSheet = analysis.selectedSheet;
      headerRow = analysis.headerRow;
      mapping = analysis.mapping as Record<string, string>;
      missingFields = analysis.issues
        .filter((issue) => issue.code === "MISSING_FIELDS")
        .flatMap((issue) => issue.message.replace(/^Falta identificar:\s*/, "").replace(/\.$/, "").split(", ").filter(Boolean));
      summary = {
        rowCount: analysis.summary.validRowCount,
        accountIds: analysis.summary.accountIds,
        skuIds: analysis.summary.skuIds,
        periods: analysis.summary.periods,
        ...("currencies" in analysis.summary ? { currencies: analysis.summary.currencies } : {}),
        ...("allocatedUnits" in analysis.summary ? { allocatedUnits: analysis.summary.allocatedUnits } : {}),
        workbook: {
          sheetNames: analysis.sheetNames,
          selectedSheet: analysis.selectedSheet,
          headerRow: analysis.headerRow,
          sourceHeaders: analysis.sourceHeaders,
          mapping: analysis.mapping,
          confidence: analysis.confidence,
          sourceRowCount: analysis.summary.rowCount,
          validRowCount: analysis.summary.validRowCount,
          rejectedRowCount: analysis.summary.rejectedRowCount,
          ...("coverageMonths" in analysis.summary ? { coverageMonths: analysis.summary.coverageMonths } : {}),
          ...("allocatedUnits" in analysis.summary ? { allocatedUnits: analysis.summary.allocatedUnits } : {}),
          preview: analysis.canonicalRows.slice(0, 5),
        },
      };
      canonicalPayload = JSON.stringify({
        contract: requirementId === "sales-history"
          ? "REVENUE-CANONICAL-SALES-V1"
          : financialRequirements.has(requirementId)
            ? "REVENUE-CANONICAL-FINANCIAL-V1"
            : "REVENUE-CANONICAL-GROWTH-V1",
        source: {
          originalName: file.name,
          selectedSheet: analysis.selectedSheet,
          headerRow: analysis.headerRow,
          mapping: analysis.mapping,
        },
        rows: analysis.canonicalRows,
      });
    } else {
      const text = new TextDecoder().decode(bytes);
      const validation = validateCsvContent(requirementId, text);
      status = validation.status;
      issues = validation.issues;
      summary = { ...validation.summary };
      missingFields = validation.issues
        .filter((issue) => issue.code === "MISSING_FIELDS")
        .flatMap((issue) =>
          issue.message.replace(/^Faltan columnas:\s*/, "").replace(/\.$/, "").split(", ").filter(Boolean),
        );
    }
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const checksum = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    const receivedAt = new Date().toISOString();
    const objectKey = `${ownerId}/${planId}/${requirementId}/source/${checksum}.${extension}`;
    const contentType = isExcel
      ? extension === "xls"
        ? "application/vnd.ms-excel"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      : "text/csv";
    await files().put(objectKey, bytes, { httpMetadata: { contentType } });
    const id = `input:${crypto.randomUUID()}`;
    await database()
      .prepare(
        `INSERT INTO input_package_files
        (id, plan_id, requirement_id, owner_id, original_name, object_key, content_type, size_bytes, checksum, status, missing_fields_json, validation_json, summary_json, received_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(plan_id, requirement_id) DO UPDATE SET
        id=excluded.id, owner_id=excluded.owner_id, original_name=excluded.original_name,
        object_key=excluded.object_key, content_type=excluded.content_type,
        size_bytes=excluded.size_bytes, checksum=excluded.checksum, status=excluded.status,
        missing_fields_json=excluded.missing_fields_json, validation_json=excluded.validation_json,
        summary_json=excluded.summary_json, received_at=excluded.received_at`,
      )
      .bind(
        id, planId, requirementId, ownerId, file.name, objectKey, contentType,
        file.size, checksum, status, JSON.stringify(missingFields),
        JSON.stringify(issues), JSON.stringify(summary), receivedAt,
      )
      .run();
    if (canonicalPayload) {
      const canonicalBytes = new TextEncoder().encode(canonicalPayload);
      const canonicalObjectKey = `${ownerId}/${planId}/${requirementId}/canonical/${checksum}.json`;
      await files().put(
        canonicalObjectKey,
        canonicalBytes.buffer.slice(
          canonicalBytes.byteOffset,
          canonicalBytes.byteOffset + canonicalBytes.byteLength,
        ) as ArrayBuffer,
        { httpMetadata: { contentType: "application/json" } },
      );
      await database()
        .prepare(
          `INSERT INTO canonical_datasets
          (id, plan_id, requirement_id, owner_id, source_checksum, source_object_key,
          canonical_object_key, selected_sheet, header_row, mapping_json, summary_json, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(plan_id, requirement_id) DO UPDATE SET
          id=excluded.id, owner_id=excluded.owner_id, source_checksum=excluded.source_checksum,
          source_object_key=excluded.source_object_key, canonical_object_key=excluded.canonical_object_key,
          selected_sheet=excluded.selected_sheet, header_row=excluded.header_row,
          mapping_json=excluded.mapping_json, summary_json=excluded.summary_json,
          status=excluded.status, created_at=excluded.created_at`,
        )
        .bind(
          `dataset:${crypto.randomUUID()}`, planId, requirementId, ownerId, checksum,
          objectKey, canonicalObjectKey, selectedSheet, headerRow, JSON.stringify(mapping),
          JSON.stringify(summary), status, receivedAt,
        )
        .run();
    } else {
      await database()
        .prepare("DELETE FROM canonical_datasets WHERE plan_id = ? AND requirement_id = ?")
        .bind(planId, requirementId)
        .run();
    }
    await database()
      .prepare("DELETE FROM input_package_reviews WHERE plan_id = ?")
      .bind(planId)
      .run();
    return Response.json({
      ok: true,
      result: {
        requirementId,
        originalName: file.name,
        sizeBytes: file.size,
        checksum,
        status,
        missingFields,
        issues,
        summary,
        receivedAt,
      },
    });
  } catch (error) {
    return responseError(error);
  }
}

export async function PUT() {
  try {
    // Replacing an uploaded file must invalidate the accepted package and DELETE FROM baseline_reviews;
    // it also clears DELETE FROM baseline_calculations before any new official file is accepted.
    // this endpoint is intentionally disabled so no non-official synthetic source can be generated.
    throw new Error("La demo usa exclusivamente los archivos oficiales de outputs/demo_sintetica_oficial/; cárgalos directamente en Información");
  } catch (error) {
    return responseError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    requireAdmin(request);
    const body = (await request.json()) as { planId?: string };
    const planId = body.planId ?? "";
    if (!planId) throw new Error("planId es obligatorio");
    const { dataOwnerId: ownerId } = await authorizePlan(request, planId, ["PLAN_INTEGRATE"]);
    const result = await database()
      .prepare(
        "SELECT requirement_id, status, checksum, summary_json FROM input_package_files WHERE plan_id = ? AND owner_id = ?",
      )
      .bind(planId, ownerId)
      .run<{
        requirement_id: string;
        status: string;
        checksum: string;
        summary_json: string;
      }>();
    const rows = result.results ?? [];
    const summaries = rows.map((row) => ({
      requirementId: row.requirement_id,
      status: row.status,
      summary: JSON.parse(row.summary_json),
    }));
    const packageIssues = validatePackageCorrespondence(summaries);
    if (!canAcceptInputPackage(summaries, packageIssues)) {
      throw new Error("El paquete aún tiene insumos esenciales o correspondencias pendientes");
    }
    const acceptedAt = new Date().toISOString();
    const checksums = Object.fromEntries(rows.map((row) => [row.requirement_id, row.checksum]));
    await database()
      .prepare(
        `INSERT INTO input_package_reviews
        (plan_id, owner_id, contract_version, status, file_checksums_json, accepted_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(plan_id) DO UPDATE SET owner_id=excluded.owner_id,
        contract_version=excluded.contract_version, status=excluded.status,
        file_checksums_json=excluded.file_checksums_json, accepted_at=excluded.accepted_at`,
      )
      .bind(
        planId,
        ownerId,
        "REVENUE-PILOT-V1",
        "ACCEPTED",
        JSON.stringify(checksums),
        acceptedAt,
      )
      .run();
    return Response.json({ ok: true, result: { status: "ACCEPTED", acceptedAt } });
  } catch (error) {
    return responseError(error);
  }
}
