"use client";

import { useEffect, useState } from "react";
import type { Plan } from "../domain/types";
import {
  createEmptyInputPackage,
  PILOT_INPUT_REQUIREMENTS,
} from "../domain/input-package";
import type { InputRequirement } from "../domain/input-package";

type View = "portfolio" | "create" | "workspace";
type ReceivedFile = {
  requirementId: string;
  originalName: string;
  status: "READY" | "INCOMPLETE";
  missingFields: string[];
  issues: Array<{ code: string; message: string; rows?: number[] }>;
  summary: {
    rowCount: number;
    accountIds: string[];
    skuIds: string[];
    periods: string[];
    currencies?: string[];
    workbook?: {
      sheetNames: string[];
      selectedSheet: string | null;
      headerRow: number | null;
      sourceHeaders: string[];
      mapping: Record<string, string>;
      confidence: number;
      sourceRowCount: number;
      validRowCount: number;
      rejectedRowCount: number;
      coverageMonths?: number;
      allocatedUnits?: number;
      preview: Array<{
        account_id: string;
        sku_id: string;
        period: string;
        units: number;
        value: number;
        currency: string;
      } & Record<string, unknown>>;
    };
  };
  receivedAt: string;
  synthetic?: boolean;
};
type BaselineResult = {
  methodId: string;
  methodVersion: string;
  targetYear: number;
  dataClassification: "SYNTHETIC_NON_COMMERCIAL" | "USER_PROVIDED";
  lines: Array<{
    accountId: string;
    skuId: string;
    period: string;
    calculatedUnits: number;
    confidence: number;
  }>;
  annualUnits: number;
  historyPeriods: number;
  explanation: string;
};
type BaselineReview = {
  status: "ADJUSTMENT_PROPOSED" | "APPROVED_FROZEN";
  decision: "CALCULATED" | "ADJUSTED";
  calculatedAnnualUnits: number;
  adjustedAnnualUnits?: number | null;
  approvedAnnualUnits?: number | null;
  reason: string;
  evidence: string;
  decidedBy: string;
  decidedAt: string;
  frozenAt?: string | null;
  methodId: string;
  methodVersion: string;
  adjustedLines?: Array<{accountId:string;skuId:string;period:string;adjustedUnits:number}>|null;
  officializationAllowed?: boolean;
};
type GrowthResult = {
  dataClassification: "SYNTHETIC_NON_COMMERCIAL" | "USER_PROVIDED";
  methodId: string;
  methodVersion: string;
  activities: Array<{
    id: string;
    family: "MARKETING" | "TRADE_MARKETING";
    name: string;
    skuId: string;
    period: string;
    grossUnits: number;
    cannibalizationUnits: number;
    haloUnits: number;
    pullForwardUnits: number;
    interactionUnits: number;
    netUnits: number;
    evidence: string;
    status: string;
    createdBy: string;
  }>;
  grossUnits: number;
  netUnits: number;
  controls: {
    duplicateEconomicIdentities: number;
    unresolvedOverlaps: number;
    reconciled: boolean;
  };
};
type PlanResult = {
  dataClassification: "SYNTHETIC_NON_COMMERCIAL" | "USER_PROVIDED";
  methodId: string;
  methodVersion: string;
  lines: Array<{
    accountId: string;
    skuId: string;
    period: string;
    baselineUnits: number;
    incrementalNetUnits: number;
    authorizedAdjustmentUnits?: number;
    planUnits: number;
    sourceUnit: string;
    baseUnit: string;
    conversionFactor: number;
    derivedCases: number;
    unitPrice: number;
    currency: string;
    priceType: string;
    validFrom: string;
    planValue: number;
  }>;
  annualUnits: number;
  annualValue: number;
  currency: string;
  controls: {
    unitsReconciled: boolean;
    valueReconciled: boolean;
    missingConversions: number;
    missingPrices: number;
  };
};
type ProfitabilityResult = {
  dataClassification: "SYNTHETIC_NON_COMMERCIAL";
  comparator: { id: string; name: string; explanation: string };
  parameters: {
    id: string;
    version: string;
    deductionRate: number;
    cogsRateOnNetSales: number;
    investmentRateOnIncrementalGross: number;
    corporatePolicy: false;
    explanation: string;
  };
  currency: string;
  comparatorAnnual: FinancialSide;
  planAnnual: FinancialSide;
  variance: { netSales: number; grossMargin: number; contribution: number };
  controls: {
    planReconciled: boolean;
    comparatorReconciled: boolean;
    corporatePolicyApproved: false;
  };
};
type FinancialSide = {
  grossSales: number;
  deductions: number;
  netSales: number;
  cogs: number;
  grossMargin: number;
  investment: number;
  contribution: number;
  grossMarginRate: number | null;
  contributionRate: number | null;
};

const currentYear = new Date().getFullYear();
const salesFieldLabels = {
  account_id: "Cuenta",
  sku_id: "Producto / SKU",
  period: "Periodo",
  units: "Unidades",
  value: "Valor",
  currency: "Moneda",
};

function activeVersion(plan: Plan) {
  return plan.versions.at(-1);
}

function friendlyError(message: string) {
  if (/Autenticación/.test(message)) {
    return "Tu sesión no está disponible. Vuelve a abrir el sitio privado e inténtalo otra vez.";
  }
  if (/Conflicto/.test(message)) {
    return "El Plan cambió en otra sesión. Actualiza la lista antes de continuar.";
  }
  return message || "No pudimos completar la acción. Tu información no se perdió.";
}

function aggregateBaseline(
  lines: BaselineResult["lines"],
  level: "Año" | "Trimestre" | "Mes" | "SKU",
) {
  const groups = new Map<string, { units: number; confidenceTotal: number; count: number }>();
  for (const line of lines) {
    const month = Number(line.period.slice(5, 7));
    const label = level === "SKU"
      ? line.skuId
      : level === "Año"
      ? line.period.slice(0, 4)
      : level === "Trimestre"
        ? `${line.period.slice(0, 4)} · T${Math.ceil(month / 3)}`
        : line.period;
    const current = groups.get(label) ?? { units: 0, confidenceTotal: 0, count: 0 };
    groups.set(label, {
      units: current.units + line.calculatedUnits,
      confidenceTotal: current.confidenceTotal + line.confidence,
      count: current.count + 1,
    });
  }
  return [...groups.entries()].map(([period, value]) => ({
    period,
    units: value.units,
    confidence: value.confidenceTotal / value.count,
  }));
}

export default function PlansWorkspace({
  initialPlanId,
  startInCreate = false,
  onExit,
}: {
  initialPlanId?: string;
  startInCreate?: boolean;
  onExit?: () => void;
}) {
  const [view, setView] = useState<View>(startInCreate ? "create" : "portfolio");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selected, setSelected] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [year, setYear] = useState(currentYear + 1);
  const [currency, setCurrency] = useState("MXN");
  const [showInformation, setShowInformation] = useState(false);
  const [receivedFiles, setReceivedFiles] = useState<ReceivedFile[]>([]);
  const [uploadingRequirement, setUploadingRequirement] = useState("");
  const [packageIssues, setPackageIssues] = useState<Array<{ code: string; message: string }>>([]);
  const [systemReady, setSystemReady] = useState(false);
  const [packageAccepted, setPackageAccepted] = useState(false);
  const [acceptingPackage, setAcceptingPackage] = useState(false);
  const [loadingSynthetic, setLoadingSynthetic] = useState(false);
  const [showBaselineGate, setShowBaselineGate] = useState(false);
  const [showGrowthGate, setShowGrowthGate] = useState(false);
  const [showResultGate, setShowResultGate] = useState(false);
  const [showVersionGate, setShowVersionGate] = useState(false);
  const [baseline, setBaseline] = useState<BaselineResult | null>(null);
  const [baselineReview, setBaselineReview] = useState<BaselineReview | null>(null);
  const [calculatingBaseline, setCalculatingBaseline] = useState(false);
  const [periodLevel, setPeriodLevel] = useState<"Año" | "Trimestre" | "Mes" | "SKU">("Año");
  const [showAdjustment, setShowAdjustment] = useState(false);
  const [baselineEdits,setBaselineEdits]=useState<Record<string,string>>({});
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [adjustmentEvidence, setAdjustmentEvidence] = useState("");
  const [savingReview, setSavingReview] = useState(false);
  const [growth, setGrowth] = useState<GrowthResult | null>(null);
  const [editingGrowth,setEditingGrowth]=useState(false);
  const [growthDraft,setGrowthDraft]=useState<GrowthResult["activities"]>([]);
  const [buildingGrowth, setBuildingGrowth] = useState(false);
  const [planResult, setPlanResult] = useState<PlanResult | null>(null);
  const [editingResult,setEditingResult]=useState(false);
  const [resultDraft,setResultDraft]=useState<PlanResult["lines"]>([]);
  const [resultEditReason,setResultEditReason]=useState("");
  const [resultEditEvidence,setResultEditEvidence]=useState("");
  const [calculatingResult, setCalculatingResult] = useState(false);
  const [profitability, setProfitability] = useState<ProfitabilityResult | null>(null);
  const [calculatingProfitability, setCalculatingProfitability] = useState(false);
  const [presentationMode, setPresentationMode] = useState(false);
  const [submittingPlan, setSubmittingPlan] = useState(false);
  const [submissionMessage, setSubmissionMessage] = useState("");

  async function loadPlans() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/plans", { cache: "no-store" });
      const body = (await response.json()) as {
        ok: boolean;
        plans?: Plan[];
        error?: string;
      };
      if (!response.ok || !body.ok) throw new Error(body.error);
      setPlans(body.plans ?? []);
    } catch (cause) {
      setError(friendlyError(cause instanceof Error ? cause.message : ""));
    } finally {
      setLoading(false);
    }
  }

  // La apertura inicial sólo se vuelve a evaluar cuando cambia el Plan solicitado.
  useEffect(() => {
    let active = true;
    fetch("/api/plans", { cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json()) as {
          ok: boolean;
          plans?: Plan[];
          error?: string;
        };
        if (!response.ok || !body.ok) throw new Error(body.error);
        if (active) {
          const loadedPlans = body.plans ?? [];
          setPlans(loadedPlans);
          const requestedPlan = initialPlanId
            ? loadedPlans.find((plan) => plan.id === initialPlanId)
            : undefined;
          if (requestedPlan) {
            setSelected(requestedPlan);
            setShowInformation(true);
            setReceivedFiles([]);
            setShowBaselineGate(false);
            setShowGrowthGate(false);
            setShowResultGate(false);
            setShowVersionGate(false);
            void loadInputFiles(requestedPlan.id);
            setView("workspace");
          }
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(friendlyError(cause instanceof Error ? cause.message : ""));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPlanId]);

  async function createPlan(event: React.FormEvent) {
    event.preventDefault();
    if (!companyName.trim() || !accountName.trim()) {
      setError("Completa compañía y cuenta para crear el Plan.");
      return;
    }
    setSaving(true);
    setError("");
    const occurredAt = new Date().toISOString();
    const planId = `plan:${crypto.randomUUID()}`;
    const versionId = `version:${crypto.randomUUID()}`;
    const plan: Plan = {
      id: planId,
      organizationId: "revenue-pilot",
      companyId: companyName.trim().toLowerCase().replace(/\s+/g, "-"),
      companyName: companyName.trim(),
      accountId: accountName.trim().toLowerCase().replace(/\s+/g, "-"),
      accountName: accountName.trim(),
      year,
      currency,
      versions: [{
        id: versionId,
        planId,
        number: 1,
        kind: "PLAN",
        status: "DRAFT",
        createdBy: "authenticated-user",
        createdAt: occurredAt,
        lines: [],
        overrides: [],
        validations: [],
        approvals: [],
      }],
    };
    try {
      const response = await fetch("/api/plans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "create",
          plan,
          context: {
            commandId: `create:${crypto.randomUUID()}`,
            actorId: "authenticated-user",
            occurredAt,
          },
        }),
      });
      const body = (await response.json()) as {
        ok: boolean;
        result?: Plan;
        error?: string;
      };
      if (!response.ok || !body.ok || !body.result) throw new Error(body.error);
      setPlans((current) => [body.result as Plan, ...current]);
      setSelected(body.result);
      setShowInformation(true);
      setView("workspace");
    } catch (cause) {
      setError(friendlyError(cause instanceof Error ? cause.message : ""));
    } finally {
      setSaving(false);
    }
  }

  async function submitPlanForReview(isSynthetic: boolean) {
    if (!selected) return;
    const version = activeVersion(selected);
    if (!version || isSynthetic) return;
    setSubmittingPlan(true);
    setSubmissionMessage("");
    setError("");
    const occurredAt = new Date().toISOString();
    try {
      const response = await fetch("/api/plans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "freezeAndSubmit",
          planId: selected.id,
          versionId: version.id,
          context: {
            commandId: `submit:${crypto.randomUUID()}`,
            actorId: "authenticated-user",
            occurredAt,
          },
        }),
      });
      const body = (await response.json()) as {
        ok: boolean;
        result?: { version: Plan["versions"][number]; snapshotSha256: string };
        error?: string;
      };
      if (!response.ok || !body.ok || !body.result) throw new Error(body.error);
      const updatedPlan = {
        ...selected,
        versions: selected.versions.map((item) =>
          item.id === body.result?.version.id ? body.result.version : item,
        ),
      };
      setSelected(updatedPlan);
      setPlans((current) =>
        current.map((item) => item.id === updatedPlan.id ? updatedPlan : item),
      );
      setSubmissionMessage("Plan congelado y enviado a revisión correctamente.");
    } catch (cause) {
      setError(friendlyError(cause instanceof Error ? cause.message : ""));
    } finally {
      setSubmittingPlan(false);
    }
  }

  async function loadInputFiles(planId: string) {
    try {
      const response = await fetch(`/api/inputs?planId=${encodeURIComponent(planId)}`, { cache: "no-store" });
      const body = (await response.json()) as {
        ok: boolean;
        files?: ReceivedFile[];
        packageIssues?: Array<{ code: string; message: string }>;
        systemReady?: boolean;
        accepted?: boolean;
      };
      if (response.ok && body.ok) {
        setReceivedFiles(body.files ?? []);
        setShowInformation(body.accepted !== true);
        setPackageIssues(body.packageIssues ?? []);
        setSystemReady(body.systemReady ?? false);
        setPackageAccepted(body.accepted ?? false);
        if (body.accepted) void loadBaseline(planId);
      }
    } catch {
      setReceivedFiles([]);
      setPackageIssues([]);
      setSystemReady(false);
      setPackageAccepted(false);
    }
  }

  async function loadBaseline(planId: string) {
    try {
      const response = await fetch(`/api/baseline?planId=${encodeURIComponent(planId)}`, { cache: "no-store" });
      const body = (await response.json()) as {
        ok: boolean;
        result?: BaselineResult | null;
        review?: BaselineReview | null;
      };
      if (response.ok && body.ok) {
        setBaseline(body.result ?? null);
        setBaselineReview(body.review ?? null);
        if (body.review?.status === "APPROVED_FROZEN") void loadGrowth(planId);
      }
    } catch {
      setBaseline(null);
      setBaselineReview(null);
    }
  }

  async function loadGrowth(planId: string) {
    try {
      const response = await fetch(`/api/growth?planId=${encodeURIComponent(planId)}`, { cache: "no-store" });
      const body = (await response.json()) as { ok: boolean; result?: GrowthResult | null };
      if (response.ok && body.ok) {
        setGrowth(body.result ?? null);
        if (body.result?.controls.reconciled) void loadPlanResult(planId);
      }
    } catch {
      setGrowth(null);
    }
  }

  async function loadPlanResult(planId: string) {
    try {
      const response = await fetch(`/api/result?planId=${encodeURIComponent(planId)}`, { cache: "no-store" });
      const body = (await response.json()) as { ok: boolean; result?: PlanResult | null };
      if (response.ok && body.ok) {
        setPlanResult(body.result ?? null);
        if (body.result?.controls.unitsReconciled && body.result.controls.valueReconciled) {
          void loadProfitability(planId);
        }
      }
    } catch {
      setPlanResult(null);
    }
  }

  async function loadProfitability(planId: string) {
    try {
      const response = await fetch(`/api/profitability?planId=${encodeURIComponent(planId)}`, { cache: "no-store" });
      const body = (await response.json()) as { ok: boolean; result?: ProfitabilityResult | null };
      if (response.ok && body.ok) setProfitability(body.result ?? null);
    } catch {
      setProfitability(null);
    }
  }

  async function calculateProfitability() {
    if (!selected) return;
    setCalculatingProfitability(true);
    setError("");
    try {
      const response = await fetch("/api/profitability", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId: selected.id }),
      });
      const body = (await response.json()) as {
        ok: boolean;
        result?: ProfitabilityResult;
        error?: string;
      };
      if (!response.ok || !body.ok || !body.result) throw new Error(body.error);
      setProfitability(body.result);
    } catch (cause) {
      setError(friendlyError(cause instanceof Error ? cause.message : ""));
    } finally {
      setCalculatingProfitability(false);
    }
  }

  async function calculatePlanResult() {
    if (!selected) return;
    setCalculatingResult(true);
    setError("");
    try {
      const response = await fetch("/api/result", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId: selected.id }),
      });
      const body = (await response.json()) as { ok: boolean; result?: PlanResult; error?: string };
      if (!response.ok || !body.ok || !body.result) throw new Error(body.error);
      setPlanResult(body.result);
      setProfitability(null);
    } catch (cause) {
      setError(friendlyError(cause instanceof Error ? cause.message : ""));
    } finally {
      setCalculatingResult(false);
    }
  }
  async function savePlanResult(event:React.FormEvent){event.preventDefault();if(!selected)return;setCalculatingResult(true);setError("");try{const response=await fetch("/api/result",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({planId:selected.id,reason:resultEditReason,evidence:resultEditEvidence,lines:resultDraft.map(line=>({accountId:line.accountId,skuId:line.skuId,period:line.period,authorizedAdjustmentUnits:line.authorizedAdjustmentUnits??0,unitPrice:line.unitPrice}))})});const body=await response.json() as {ok:boolean;result?:PlanResult;error?:string};if(!response.ok||!body.ok||!body.result)throw new Error(body.error);setPlanResult(body.result);setProfitability(null);setEditingResult(false);}catch(cause){setError(friendlyError(cause instanceof Error?cause.message:""));}finally{setCalculatingResult(false);}}

  async function buildGrowth() {
    if (!selected) return;
    setBuildingGrowth(true);
    setError("");
    try {
      const response = await fetch("/api/growth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId: selected.id }),
      });
      const body = (await response.json()) as { ok: boolean; result?: GrowthResult; error?: string };
      if (!response.ok || !body.ok || !body.result) throw new Error(body.error);
      setGrowth(body.result);
      setPlanResult(null);
    } catch (cause) {
      setError(friendlyError(cause instanceof Error ? cause.message : ""));
    } finally {
      setBuildingGrowth(false);
    }
  }
  async function saveGrowth(){if(!selected)return;setBuildingGrowth(true);setError("");try{const response=await fetch("/api/growth",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({planId:selected.id,activities:growthDraft})});const body=await response.json() as {ok:boolean;result?:GrowthResult;error?:string};if(!response.ok||!body.ok||!body.result)throw new Error(body.error);setGrowth(body.result);setPlanResult(null);setProfitability(null);setEditingGrowth(false);}catch(cause){setError(friendlyError(cause instanceof Error?cause.message:""));}finally{setBuildingGrowth(false);}}

  async function loadSyntheticPackage() {
    if (!selected) return;
    setLoadingSynthetic(true);
    setError("");
    try {
      const response = await fetch("/api/inputs", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId: selected.id }),
      });
      const body = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !body.ok) throw new Error(body.error);
      setBaseline(null);
      await loadInputFiles(selected.id);
      setShowInformation(true);
    } catch (cause) {
      setError(friendlyError(cause instanceof Error ? cause.message : ""));
    } finally {
      setLoadingSynthetic(false);
    }
  }

  async function calculateBaseline() {
    if (!selected || !packageAccepted) return;
    setCalculatingBaseline(true);
    setError("");
    try {
      const response = await fetch("/api/baseline", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId: selected.id }),
      });
      const body = (await response.json()) as { ok: boolean; result?: BaselineResult; error?: string };
      if (!response.ok || !body.ok || !body.result) throw new Error(body.error);
      setBaseline(body.result);
      setBaselineReview(null);
    } catch (cause) {
      setError(friendlyError(cause instanceof Error ? cause.message : ""));
    } finally {
      setCalculatingBaseline(false);
    }
  }

  async function proposeBaselineAdjustment(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setSavingReview(true);
    setError("");
    try {
      const response = await fetch("/api/baseline", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          planId: selected.id,
          adjustments: baseline?.lines.map(line=>({accountId:line.accountId,skuId:line.skuId,period:line.period,adjustedUnits:Number(baselineEdits[`${line.accountId}|${line.skuId}|${line.period}`]??baselineReview?.adjustedLines?.find(item=>item.accountId===line.accountId&&item.skuId===line.skuId&&item.period===line.period)?.adjustedUnits??line.calculatedUnits)})),
          reason: adjustmentReason,
          evidence: adjustmentEvidence,
        }),
      });
      const body = (await response.json()) as { ok: boolean; review?: BaselineReview; error?: string };
      if (!response.ok || !body.ok || !body.review) throw new Error(body.error);
      setBaselineReview(body.review);
      void loadGrowth(selected.id);
      setShowAdjustment(false);
    } catch (cause) {
      setError(friendlyError(cause instanceof Error ? cause.message : ""));
    } finally {
      setSavingReview(false);
    }
  }

  async function approveBaseline(decision: "CALCULATED" | "ADJUSTED") {
    if (!selected) return;
    setSavingReview(true);
    setError("");
    try {
      const response = await fetch("/api/baseline", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId: selected.id, decision }),
      });
      const body = (await response.json()) as { ok: boolean; review?: BaselineReview; error?: string };
      if (!response.ok || !body.ok || !body.review) throw new Error(body.error);
      setBaselineReview(body.review);
    } catch (cause) {
      setError(friendlyError(cause instanceof Error ? cause.message : ""));
    } finally {
      setSavingReview(false);
    }
  }

  function openPlan(plan: Plan) {
    setSelected(plan);
    setShowInformation(true);
    setReceivedFiles([]);
    setShowBaselineGate(false);
    setShowGrowthGate(false);
    setShowResultGate(false);
    setShowVersionGate(false);
    void loadInputFiles(plan.id);
    setView("workspace");
    setError("");
  }

  async function uploadInput(requirementId: string, file: File | undefined) {
    if (!selected || !file) return;
    setUploadingRequirement(requirementId);
    setError("");
    try {
      const form = new FormData();
      form.set("planId", selected.id);
      form.set("requirementId", requirementId);
      form.set("file", file);
      const response = await fetch("/api/inputs", { method: "POST", body: form });
      const body = (await response.json()) as { ok: boolean; result?: ReceivedFile; error?: string };
      if (!response.ok || !body.ok || !body.result) throw new Error(body.error);
      setReceivedFiles((current) => [
        body.result as ReceivedFile,
        ...current.filter((item) => item.requirementId !== requirementId),
      ]);
      await loadInputFiles(selected.id);
    } catch (cause) {
      setError(friendlyError(cause instanceof Error ? cause.message : ""));
    } finally {
      setUploadingRequirement("");
    }
  }

  function downloadTemplate(requirement: InputRequirement) {
    const content = `${requirement.requiredFields.join(",")}\n`;
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `REVENUE_${requirement.id}_plantilla.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function acceptInputPackage() {
    if (!selected || !systemReady) return;
    setAcceptingPackage(true);
    setError("");
    try {
      const response = await fetch("/api/inputs", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId: selected.id }),
      });
      const body = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !body.ok) throw new Error(body.error);
      setPackageAccepted(true);
      setShowBaselineGate(true);
    } catch (cause) {
      setError(friendlyError(cause instanceof Error ? cause.message : ""));
    } finally {
      setAcceptingPackage(false);
    }
  }

  if (view === "create") {
    return (
      <div className="page empty-plan-page">
        <div className="page-head">
          <div>
            <p className="eyebrow">Crear Plan anual</p>
            <h1>Crea un Plan por cuenta</h1><p>Identifica el Plan. Al guardarlo pasarás directamente a cargar y validar los datasets imprescindibles.</p>
          </div>
          <button className="secondary" onClick={() => onExit ? onExit() : setView("portfolio")}>← Volver al lobby</button>
        </div>
        <form className="panel create-plan-card" onSubmit={createPlan}>
          <div className="create-plan-intro">
            <span>1</span>
            <div>
              <h2>Datos del Plan</h2><p>La cuenta, el año y la moneda quedarán asociados a toda la construcción y sus versiones.</p>
            </div>
          </div>
          <div className="form-grid">
            <label>Compañía<input value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder="Escribe la compañía" required /></label>
            <label>Cuenta<input value={accountName} onChange={(event) => setAccountName(event.target.value)} placeholder="Escribe la cuenta" required /></label>
            <label>Año del Plan<input type="number" min={currentYear} max={currentYear + 5} value={year} onChange={(event) => setYear(Number(event.target.value))} required /></label>
            <label>Moneda base<select value={currency} onChange={(event) => setCurrency(event.target.value)}><option>MXN</option><option>USD</option></select></label>
          </div>
          <div className="dataset-first-notice">
            <span>1</span><div><b>Siguiente: cargar información</b><small>Ventas del año anterior, actividades y promociones, catálogo de productos, conversiones y precios. REVENUE validará estructura y cobertura antes de calcular.</small></div>
          </div>
          {error && <div className="recoverable-error" role="alert">{error}</div>}
          <div className="create-plan-actions">
            <button type="button" className="secondary" onClick={() => onExit ? onExit() : setView("portfolio")}>Cancelar</button>
            <button className="primary" disabled={saving}>{saving ? "Guardando…" : "Guardar y cargar datasets"}</button>
          </div>
        </form>
      </div>
    );
  }

  if (view === "workspace" && selected) {
    const version = activeVersion(selected);
    const inputPackage = createEmptyInputPackage(selected.id);
    const essentialReady = PILOT_INPUT_REQUIREMENTS.filter(
      (requirement) =>
        requirement.criticality === "ESSENTIAL" &&
        receivedFiles.some(
          (file) => file.requirementId === requirement.id && file.status === "READY",
        ),
    ).length;
    const salesEvidence = receivedFiles.find(
      (file) => file.requirementId === "sales-history" && file.status === "READY",
    );
    const activityEvidence = receivedFiles.find(
      (file) => file.requirementId === "activity-history" && file.status === "READY",
    );
    const syntheticPackage = receivedFiles.length > 0 && receivedFiles.every((file) => file.synthetic);
    const visibleBaselineLines = baseline ? aggregateBaseline(baseline.lines, periodLevel) : [];
    return (
      <div className="page empty-plan-page">
        <div className="page-head">
          <div>
            <p className="eyebrow">{selected.companyName ?? selected.companyId} · {selected.accountName ?? selected.accountId} · {selected.year}</p>
            <h1>{selected.accountName ?? selected.accountId} · Plan anual {selected.year}</h1>
            <p>Versión {version?.number ?? 1} · Borrador guardado</p>
          </div>
          <span className="status-chip">{packageAccepted ? "✓ Paquete aceptado" : "● Información pendiente"}</span>
        </div>
        <div className="plan-tabs">
          <button className={showInformation?"active":""} onClick={()=>{setShowInformation(true);setShowBaselineGate(false);setShowGrowthGate(false);setShowResultGate(false);setShowVersionGate(false);}}>Datasets</button>
          <button className={!showInformation&&!showBaselineGate&&!showGrowthGate&&!showResultGate&&!showVersionGate?"active":""} onClick={()=>{setShowInformation(false);setShowBaselineGate(false);setShowGrowthGate(false);setShowResultGate(false);setShowVersionGate(false);}}>Vista integral</button>
          <button className={showBaselineGate ? "active" : ""} onClick={() => packageAccepted ? (setShowBaselineGate(true),setShowInformation(false),setShowGrowthGate(false),setShowResultGate(false),setShowVersionGate(false)) : (setShowInformation(true),setShowBaselineGate(false))}>Baseline</button>
          <button className={showGrowthGate ? "active" : ""} onClick={() => baselineReview?.status === "APPROVED_FROZEN" ? (setShowInformation(false),setShowBaselineGate(false),setShowGrowthGate(true),setShowResultGate(false),setShowVersionGate(false)) : (setShowInformation(packageAccepted),setShowBaselineGate(packageAccepted),setShowGrowthGate(false))}>Crecimiento</button>
          <button className={showResultGate ? "active" : ""} onClick={() => growth?.controls.reconciled ? (setShowInformation(false),setShowBaselineGate(false),setShowGrowthGate(false),setShowResultGate(true),setShowVersionGate(false)) : (setShowInformation(!packageAccepted),setShowBaselineGate(packageAccepted&&baselineReview?.status!=="APPROVED_FROZEN"),setShowGrowthGate(baselineReview?.status==="APPROVED_FROZEN"),setShowResultGate(false))}>Resultado y rentabilidad</button>
          <button className={showVersionGate ? "active" : ""} onClick={() => profitability ? (setShowInformation(false),setShowBaselineGate(false),setShowGrowthGate(false),setShowResultGate(false),setShowVersionGate(true)) : (setShowInformation(!packageAccepted),setShowBaselineGate(packageAccepted&&baselineReview?.status!=="APPROVED_FROZEN"),setShowGrowthGate(baselineReview?.status==="APPROVED_FROZEN"&&!growth?.controls.reconciled),setShowResultGate(Boolean(growth?.controls.reconciled)))}>Versión final</button>
        </div>
        <section className={`panel empty-workspace ${showBaselineGate || showGrowthGate || showResultGate ? "baseline-mode" : ""}`}>
          {showBaselineGate && packageAccepted && (
            <div className="baseline-workspace">
              <div className="baseline-head">
                <div>
                  <p className="eyebrow">Paso 2 · Base desimpactada</p>
                  <h2>¿Qué venderíamos sin volver a contar las actividades?</h2>
                  <p>La base desimpactada representa el volumen recurrente esperado antes de agregar Marketing y Trade Marketing al Plan.</p>
                </div>
                <span className={`calculation-state ${baseline ? "ready" : ""}`}>
                  {baselineReview?.status === "APPROVED_FROZEN" ? "✓ Aprobado y congelado" : baseline ? "✓ Calculado" : "No calculado"}
                </span>
              </div>
              {syntheticPackage && (
                <div className="synthetic-banner" role="status">
                  <b>DATOS SINTÉTICOS — NO COMERCIALES</b>
                  <span>Este resultado sirve para probar el motor y el recorrido. No representa ventas, metas ni resultados reales.</span>
                </div>
              )}

              <div className="baseline-toolbar" aria-label="Periodo del baseline">
                <span>Ver por</span>
                {(["Año", "Trimestre", "Mes", "SKU"] as const).map((level) => (
                  <button key={level} className={periodLevel === level ? "active" : ""} onClick={() => setPeriodLevel(level)}>{level}</button>
                ))}
              </div>

              <section className="baseline-evidence">
                <div className="section-copy">
                  <p className="eyebrow">Evidencia recibida</p>
                  <h3>Lo que REVENUE puede verificar hoy</h3>
                  <p>Estos conteos provienen del archivo histórico aceptado; no son cifras comerciales calculadas.</p>
                </div>
                <div className="evidence-counters">
                  <article><span>Filas históricas</span><b>{salesEvidence?.summary.rowCount ?? "Pendiente"}</b></article>
                  <article><span>Periodos distintos</span><b>{salesEvidence?.summary.periods?.length ?? "Pendiente"}</b></article>
                  <article><span>Cuentas distintas</span><b>{salesEvidence?.summary.accountIds?.length ?? "Pendiente"}</b></article>
                  <article><span>SKU distintos</span><b>{salesEvidence?.summary.skuIds?.length ?? "Pendiente"}</b></article>
                </div>
                <p className="evidence-footnote">
                  Historial de actividades: {activityEvidence ? `${activityEvidence.summary.rowCount} filas aceptadas` : "pendiente"}.
                </p>
              </section>

              <section className="baseline-logic">
                <p className="eyebrow">Lógica comercial</p>
                <div className="baseline-equation">
                  <article><span>1</span><b>Historia observada</b><small>Ventas reales recibidas</small></article>
                  <strong>−</strong>
                  <article><span>2</span><b>Actividades conocidas</b><small>Impactos ya incluidos en la historia</small></article>
                  <strong>−</strong>
                  <article><span>3</span><b>Eventos no recurrentes</b><small>Ajustes sólo con evidencia</small></article>
                  <strong>=</strong>
                  <article className="result"><span>4</span><b>Base desimpactada</b><small>Sin doble conteo</small></article>
                </div>
              </section>

              <div className="baseline-detail-grid">
                <section className="method-card">
                  <p className="eyebrow">Método</p>
                  <h3>{baseline ? "Promedio estacional desimpactado" : "Aún no seleccionado"}</h3>
                  <p>{baseline?.explanation ?? "REVENUE evaluará el comportamiento real de la historia antes de elegir un método. La selección y su justificación quedarán registradas."}</p>
                  <div className="method-options">
                    <span>Run rate</span><span className={baseline ? "selected" : ""}>Estacional</span><span>Serie de tiempo</span>
                  </div>
                </section>
                <section className="governance-card">
                  <p className="eyebrow">Control del resultado</p>
                  <dl>
                    <div><dt>Calculada</dt><dd>Resultado reproducible del método.</dd></div>
                    <div><dt>Ajustada</dt><dd>Cambio autorizado con motivo y evidencia.</dd></div>
                    <div><dt>Aprobada</dt><dd>Base congelada que alimentará el Plan.</dd></div>
                  </dl>
                </section>
              </div>

              <section className="baseline-results">
                <div className="section-copy">
                  <p className="eyebrow">Resultado · vista {periodLevel.toLowerCase()}</p>
                  <h3>Base calculada, ajustada y aprobada</h3>
                </div>
                <div className="baseline-table" role="table" aria-label="Resultados del baseline">
                  <div className="baseline-table-head" role="row">
                    <span>Periodo</span><span>Base calculada</span><span>Base ajustada</span><span>Base aprobada</span><span>Evidencia</span>
                  </div>
                  {baseline ? visibleBaselineLines.map((line) => (
                    <div className="baseline-result-row" role="row" key={line.period}>
                      <span>{line.period}</span>
                      <b>{line.units.toLocaleString("es-MX")} unidades</b>
                      <span>{baselineReview?.adjustedAnnualUnits
                        ? `${baselineReview.adjustedAnnualUnits.toLocaleString("es-MX")} unidades anuales`
                        : "Sin ajuste"}</span>
                      <span>{baselineReview?.status === "APPROVED_FROZEN"
                        ? `${baselineReview.approvedAnnualUnits?.toLocaleString("es-MX")} unidades anuales`
                        : "Pendiente de aprobación"}</span>
                      <small>Confianza {(line.confidence * 100).toFixed(0)}%</small>
                    </div>
                  )) : (
                    <div className="baseline-empty-result" role="row">
                      <span>—</span>
                      <div><b>Todavía no existe un cálculo</b><small>No se mostrarán valores hasta que el motor procese la evidencia aceptada.</small></div>
                    </div>
                  )}
                </div>
                {baseline && (
                  <p className="baseline-total">
                    Total anual calculado: <b>{baseline.annualUnits.toLocaleString("es-MX")} unidades</b> · {baseline.historyPeriods} periodos históricos procesados.
                  </p>
                )}
              </section>

              {baseline && (
                <section className="baseline-decision">
                  <div className="section-copy">
                    <p className="eyebrow">Decisión gobernada</p>
                    <h3>{baselineReview?.status === "APPROVED_FROZEN"
                      ? "La base aprobada quedó congelada"
                      : "Acepta el cálculo o propone un ajuste documentado"}</h3>
                    <p>La decisión conserva autor, fecha, método y evidencia. Un archivo reemplazado invalida esta revisión.</p>
                  </div>
                  {baselineReview?.status === "APPROVED_FROZEN" ? (
                    <div className="frozen-baseline-card">
                      <span>✓</span>
                      <div>
                        <b>{baselineReview.approvedAnnualUnits?.toLocaleString("es-MX")} unidades aprobadas</b>
                        <p>{baselineReview.reason} · {baselineReview.evidence}</p>
                        <small>{baselineReview.decidedBy} · {new Date(baselineReview.decidedAt).toLocaleString("es-MX")} · {baselineReview.methodId} v{baselineReview.methodVersion}</small>
                        {syntheticPackage && <strong>No puede convertirse en Plan oficial.</strong>}
                      </div>
                    </div>
                  ) : (
                    <>
                      {baselineReview?.status === "ADJUSTMENT_PROPOSED" && (
                        <div className="proposed-adjustment">
                          <b>Ajuste propuesto: {baselineReview.adjustedAnnualUnits?.toLocaleString("es-MX")} unidades</b>
                          <span>{baselineReview.reason} · Evidencia: {baselineReview.evidence}</span>
                        </div>
                      )}
                      <div className="baseline-decision-actions">
                        <button className="secondary" onClick={() => setShowAdjustment((current) => !current)}>Proponer ajuste</button>
                        <button className="secondary" disabled={savingReview || baselineReview?.status !== "ADJUSTMENT_PROPOSED"} onClick={() => void approveBaseline("ADJUSTED")}>Aprobar ajuste</button>
                        <button className="primary" disabled={savingReview} onClick={() => void approveBaseline("CALCULATED")}>Aceptar cálculo y congelar</button>
                      </div>
                      {showAdjustment && (
                        <form className="baseline-adjustment-form" onSubmit={proposeBaselineAdjustment}>
                          <div className="baseline-line-editor">
                            <div className="baseline-line-editor-head"><span>Mes / SKU</span><span>Calculada</span><span>Ajustada</span><span>Diferencia</span></div>
                            {baseline.lines.map((line) => {
                              const key=`${line.accountId}|${line.skuId}|${line.period}`;
                              const adjusted=Number(baselineEdits[key]??baselineReview?.adjustedLines?.find(item=>item.accountId===line.accountId&&item.skuId===line.skuId&&item.period===line.period)?.adjustedUnits??line.calculatedUnits);
                              return <div className="baseline-line-editor-row" key={key}><span><b>{line.period}</b><small>{line.skuId}</small></span><span>{line.calculatedUnits.toLocaleString("es-MX")}</span><input aria-label={`Base ajustada ${line.period} ${line.skuId}`} type="number" min="0" step="1" value={baselineEdits[key]??adjusted} onChange={event=>setBaselineEdits(current=>({...current,[key]:event.target.value}))}/><strong>{(adjusted-line.calculatedUnits).toLocaleString("es-MX")}</strong></div>;
                            })}
                          </div>
                          <label>Motivo del ajuste<textarea value={adjustmentReason} onChange={(event) => setAdjustmentReason(event.target.value)} placeholder="Explica por qué el cálculo debe cambiar" required /></label>
                          <label>Evidencia<textarea value={adjustmentEvidence} onChange={(event) => setAdjustmentEvidence(event.target.value)} placeholder="Identifica el archivo, fuente o comprobante" required /></label>
                          <button className="primary" disabled={savingReview}>{savingReview ? "Guardando…" : "Guardar propuesta"}</button>
                        </form>
                      )}
                    </>
                  )}
                </section>
              )}

              <div className="baseline-next-action">
                <div>
                  <b>{baseline ? "Cálculo técnico completado" : "Siguiente compuerta"}</b>
                  <p>{baseline ? "El resultado quedó persistido. La aprobación comercial permanece pendiente." : "Procesar el paquete aceptado sin alterar sus archivos originales."}</p>
                </div>
                <button className="primary" onClick={() => void calculateBaseline()} disabled={calculatingBaseline}>
                  {calculatingBaseline ? "Calculando…" : baseline ? "Recalcular baseline" : "Calcular baseline"}
                </button>
              </div>
            </div>
          )}
          {showGrowthGate && (
            <div className="growth-workspace">
              <div className="baseline-head">
                <div>
                  <p className="eyebrow">Paso 3 · Crecimiento gobernado</p>
                  <h2>Marketing y Trade Marketing sin doble conteo</h2>
                  <p>El incremental neto parte de la base aprobada y separa cada efecto antes de alimentar el Plan.</p>
                </div>
                <span className={`calculation-state ${growth?.controls.reconciled ? "ready" : ""}`}>{growth?.controls.reconciled ? "✓ Reconciliado" : "Pendiente"}</span>
              </div>
              <div className="synthetic-banner" role="status">
                <b>{baseline?.dataClassification === "USER_PROVIDED" ? "PLANES EMPRESARIALES — TRAZABLES" : "DATOS SINTÉTICOS — NO COMERCIALES"}</b>
                <span>{baseline?.dataClassification === "USER_PROVIDED"
                  ? "El crecimiento se construye desde los Excel de Marketing y Trade Marketing, conservando su origen."
                  : "Las actividades y sus impactos son artificiales y no representan compromisos comerciales."}</span>
              </div>
              {growth ? (
                <>
                  <div className="growth-kpis">
                    <article><span>Incremental bruto</span><b>{growth.grossUnits.toLocaleString("es-MX")} unidades</b></article>
                    <article><span>Incremental neto</span><b>{growth.netUnits.toLocaleString("es-MX")} unidades</b></article>
                    <article><span>Identidades duplicadas</span><b>{growth.controls.duplicateEconomicIdentities}</b></article>
                    <article><span>Solapamientos pendientes</span><b>{growth.controls.unresolvedOverlaps}</b></article>
                  </div>
                  <div className="growth-table">
                    <div className="growth-table-head"><span>Familia y actividad</span><span>Periodo / SKU</span><span>Bruto</span><span>Ajustes</span><span>Neto</span><span>Evidencia</span></div>
                    {(editingGrowth?growthDraft:growth.activities).map((activity,index) => (
                      <div className="growth-row" key={activity.id}>
                        <div><small>{activity.family === "MARKETING" ? "Marketing" : "Trade Marketing"}</small>{editingGrowth?<input aria-label={`Actividad ${index+1}`} value={activity.name} onChange={event=>setGrowthDraft(current=>current.map((item,i)=>i===index?{...item,name:event.target.value}:item))}/>:<b>{activity.name}</b>}</div>
                        {editingGrowth?<div><input aria-label={`Periodo ${index+1}`} value={activity.period} onChange={event=>setGrowthDraft(current=>current.map((item,i)=>i===index?{...item,period:event.target.value}:item))}/><input aria-label={`SKU ${index+1}`} value={activity.skuId} onChange={event=>setGrowthDraft(current=>current.map((item,i)=>i===index?{...item,skuId:event.target.value}:item))}/></div>:<span>{activity.period}<small>{activity.skuId}</small></span>}
                        {editingGrowth?<input aria-label={`Bruto ${index+1}`} type="number" min="0" value={activity.grossUnits} onChange={event=>setGrowthDraft(current=>current.map((item,i)=>i===index?{...item,grossUnits:Number(event.target.value)}:item))}/>:<b>{activity.grossUnits.toLocaleString("es-MX")}</b>}
                        {editingGrowth?<div className="growth-adjustment-inputs">{(["cannibalizationUnits","haloUnits","pullForwardUnits","interactionUnits"] as const).map(field=><input key={field} aria-label={`${field} ${index+1}`} type="number" value={activity[field]} onChange={event=>setGrowthDraft(current=>current.map((item,i)=>i===index?{...item,[field]:Number(event.target.value)}:item))}/>)}</div>:<span>−{activity.cannibalizationUnits} +{activity.haloUnits} −{activity.pullForwardUnits} {activity.interactionUnits < 0 ? activity.interactionUnits : `+${activity.interactionUnits}`}</span>}
                        <strong>{activity.netUnits.toLocaleString("es-MX")}</strong>
                        {editingGrowth?<div><input aria-label={`Evidencia ${index+1}`} value={activity.evidence} onChange={event=>setGrowthDraft(current=>current.map((item,i)=>i===index?{...item,evidence:event.target.value}:item))}/><button type="button" className="text-action" onClick={()=>setGrowthDraft(current=>current.filter((_,i)=>i!==index))}>Eliminar</button></div>:<small>{activity.evidence}</small>}
                      </div>
                    ))}
                  </div>
                  <div className="workspace-edit-actions">
                    {editingGrowth?<><button className="secondary" onClick={()=>setGrowthDraft(current=>[...current,{...growth.activities[0],id:`ACT-${crypto.randomUUID()}`,name:"",grossUnits:0,cannibalizationUnits:0,haloUnits:0,pullForwardUnits:0,interactionUnits:0,netUnits:0,evidence:""}])}>Agregar actividad</button><button className="secondary" onClick={()=>setEditingGrowth(false)}>Cancelar</button><button className="primary" disabled={buildingGrowth} onClick={()=>void saveGrowth()}>{buildingGrowth?"Guardando…":"Guardar crecimiento"}</button></>:<button className="primary" onClick={()=>{setGrowthDraft(growth.activities);setEditingGrowth(true);}}>Editar building blocks</button>}
                  </div>
                  <div className="growth-reconciliation">
                    <b>Incremental bruto − canibalización + halo − compra anticipada ± interacción = incremental neto</b>
                    <span>{growth.methodId} v{growth.methodVersion} · resultado persistido</span>
                  </div>
                </>
              ) : (
                <div className="baseline-next-action">
                  <div><b>{baseline?.dataClassification === "USER_PROVIDED" ? "Construir crecimiento desde los planes aprobados" : "Crear caso gobernado de crecimiento"}</b><p>{baseline?.dataClassification === "USER_PROVIDED" ? "Usará los Excel de Marketing y Trade Marketing cargados en Datasets, asignará a la cuenta su participación y reconciliará el incremental neto." : "Generará tres actividades sintéticas trazables y comprobará el incremental neto."}</p></div>
                  <button className="primary" onClick={() => void buildGrowth()} disabled={buildingGrowth}>{buildingGrowth ? "Construyendo…" : baseline?.dataClassification === "USER_PROVIDED" ? "Construir crecimiento real" : "Construir crecimiento sintético"}</button>
                </div>
              )}
            </div>
          )}
          {showResultGate && (
            <div className="result-workspace">
              <div className="baseline-head">
                <div>
                  <p className="eyebrow">Paso 4 · Unidades y valor</p>
                  <h2>Plan mensual reconciliado por SKU</h2>
                  <p>Base aprobada + incremental neto = unidades del Plan. El valor usa el precio aceptado y vigente del paquete.</p>
                </div>
                <span className={`calculation-state ${planResult?.controls.unitsReconciled && planResult.controls.valueReconciled ? "ready" : ""}`}>
                  {planResult?.controls.unitsReconciled && planResult.controls.valueReconciled ? "✓ Reconciliado" : "Pendiente"}
                </span>
              </div>
              <div className="synthetic-banner" role="status">
                <b>{growth?.dataClassification === "USER_PROVIDED" ? "RESULTADO EMPRESARIAL — TRAZABLE" : "DATOS SINTÉTICOS — NO COMERCIALES"}</b>
                <span>{growth?.dataClassification === "USER_PROVIDED"
                  ? "Las unidades conservan la cuenta y el SKU; el valor utiliza el precio oficial vigente de esa misma cuenta."
                  : "Unidades, precios y valores son artificiales y no representan venta, cuota ni compromiso comercial."}</span>
              </div>
              {planResult ? (
                <>
                  <div className="result-kpis">
                    <article><span>Unidades anuales</span><b>{planResult.annualUnits.toLocaleString("es-MX")}</b><small>Base + incremental neto</small></article>
                    <article><span>Valor anual</span><b>{planResult.annualValue.toLocaleString("es-MX", { style: "currency", currency: planResult.currency })}</b><small>Precio aceptado × unidades</small></article>
                    <article><span>Conversiones faltantes</span><b>{planResult.controls.missingConversions}</b><small>Factor por SKU</small></article>
                    <article><span>Precios faltantes</span><b>{planResult.controls.missingPrices}</b><small>Vigencia declarada</small></article>
                  </div>
                  <div className="result-table">
                    <div className="result-table-head"><span>Mes / SKU</span><span>Base aprobada</span><span>Incremental neto</span><span>Unidades Plan</span><span>Conversión</span><span>Precio</span><span>Valor</span></div>
                    {(editingResult?resultDraft:planResult.lines).map((line,index) => (
                      <div className="result-row" key={`${line.skuId}|${line.period}`}>
                        <div><b>{line.period}</b><small>{line.skuId}</small></div>
                        <span>{line.baselineUnits.toLocaleString("es-MX")}</span>
                        <span>{line.incrementalNetUnits.toLocaleString("es-MX")}</span>
                        {editingResult?<input aria-label={`Ajuste autorizado ${line.period} ${line.skuId}`} type="number" value={line.authorizedAdjustmentUnits??0} onChange={event=>setResultDraft(current=>current.map((item,i)=>i===index?{...item,authorizedAdjustmentUnits:Number(event.target.value)}:item))}/>:<strong>{line.planUnits.toLocaleString("es-MX")}</strong>}
                        <span>{line.derivedCases.toLocaleString("es-MX")} cajas<small>{line.conversionFactor} {line.baseUnit} / {line.sourceUnit}</small></span>
                        {editingResult?<input aria-label={`Precio ${line.period} ${line.skuId}`} type="number" min="0" step="0.01" value={line.unitPrice} onChange={event=>setResultDraft(current=>current.map((item,i)=>i===index?{...item,unitPrice:Number(event.target.value)}:item))}/>:<span>{line.unitPrice.toLocaleString("es-MX", { style: "currency", currency: line.currency })}<small>{line.priceType} · desde {line.validFrom}</small></span>}
                        <b>{line.planValue.toLocaleString("es-MX", { style: "currency", currency: line.currency })}</b>
                      </div>
                    ))}
                  </div>
                  {editingResult?<form className="result-edit-form" onSubmit={savePlanResult}><label>Motivo<textarea required value={resultEditReason} onChange={event=>setResultEditReason(event.target.value)}/></label><label>Evidencia<textarea required value={resultEditEvidence} onChange={event=>setResultEditEvidence(event.target.value)}/></label><div><button type="button" className="secondary" onClick={()=>setEditingResult(false)}>Cancelar</button><button className="primary" disabled={calculatingResult}>{calculatingResult?"Guardando…":"Guardar resultado"}</button></div></form>:<div className="workspace-edit-actions"><button className="primary" onClick={()=>{setResultDraft(planResult.lines);setEditingResult(true);}}>Editar tabla</button></div>}
                  <div className="result-reconciliation">
                    <div><b>Unidades reconciliadas</b><span>Base aprobada + incremental neto = Plan</span></div>
                    <div><b>Valor reconciliado</b><span>Unidades × precio aceptado = valor</span></div>
                    <small>{planResult.methodId} v{planResult.methodVersion} · resultado persistido</small>
                  </div>
                  <section className="profitability-section">
                    <div className="section-copy">
                      <p className="eyebrow">Rentabilidad · comparador declarado</p>
                      <h3>{profitability ? "P&L sintético reconciliado" : "Construir rentabilidad sin asumir reglas corporativas"}</h3>
                      <p>Comparador: valor del baseline aprobado. Los parámetros financieros son artificiales, visibles y versionados.</p>
                    </div>
                    {profitability ? (
                      <>
                        <div className="financial-warning">
                          <b>PARÁMETROS SINTÉTICOS — NO SON POLÍTICA CORPORATIVA</b>
                          <span>{profitability.parameters.explanation}</span>
                        </div>
                        <div className="financial-parameters">
                          <article><span>Deducciones</span><b>{(profitability.parameters.deductionRate * 100).toFixed(0)}%</b><small>sobre gross sales</small></article>
                          <article><span>COGS</span><b>{(profitability.parameters.cogsRateOnNetSales * 100).toFixed(0)}%</b><small>sobre net sales</small></article>
                          <article><span>Inversión</span><b>{(profitability.parameters.investmentRateOnIncrementalGross * 100).toFixed(0)}%</b><small>sobre valor incremental positivo</small></article>
                          <article><span>Versión</span><b>{profitability.parameters.version}</b><small>{profitability.parameters.id}</small></article>
                        </div>
                        <div className="pnl-comparison">
                          <div className="pnl-head"><span>Concepto</span><span>{profitability.comparator.name}</span><span>Plan sintético</span><span>Variación</span></div>
                          {([
                            ["Gross sales", "grossSales"],
                            ["− Deducciones", "deductions"],
                            ["= Net sales", "netSales"],
                            ["− COGS", "cogs"],
                            ["= Gross margin", "grossMargin"],
                            ["− Inversión", "investment"],
                            ["= Contribution", "contribution"],
                          ] as const).map(([label, field]) => (
                            <div className={`pnl-row ${field === "contribution" ? "total" : ""}`} key={field}>
                              <b>{label}</b>
                              <span>{profitability.comparatorAnnual[field].toLocaleString("es-MX", { style: "currency", currency: profitability.currency })}</span>
                              <span>{profitability.planAnnual[field].toLocaleString("es-MX", { style: "currency", currency: profitability.currency })}</span>
                              <strong>{(profitability.planAnnual[field] - profitability.comparatorAnnual[field]).toLocaleString("es-MX", { style: "currency", currency: profitability.currency })}</strong>
                            </div>
                          ))}
                        </div>
                        <div className="profitability-kpis">
                          <article><span>Margen bruto Plan</span><b>{profitability.planAnnual.grossMarginRate === null ? "No aplica" : `${(profitability.planAnnual.grossMarginRate * 100).toFixed(1)}%`}</b></article>
                          <article><span>Contribution Plan</span><b>{profitability.planAnnual.contributionRate === null ? "No aplica" : `${(profitability.planAnnual.contributionRate * 100).toFixed(1)}%`}</b></article>
                          <article><span>Variación contribution</span><b>{profitability.variance.contribution.toLocaleString("es-MX", { style: "currency", currency: profitability.currency })}</b></article>
                          <article><span>Reconciliación</span><b>{profitability.controls.planReconciled && profitability.controls.comparatorReconciled ? "Completa" : "Pendiente"}</b></article>
                        </div>
                      </>
                    ) : (
                      <div className="baseline-next-action">
                        <div><b>Calcular P&L sintético comparado</b><p>Usará parámetros artificiales explícitos y no declarará políticas corporativas.</p></div>
                        <button className="primary" onClick={() => void calculateProfitability()} disabled={calculatingProfitability}>{calculatingProfitability ? "Calculando…" : "Calcular rentabilidad"}</button>
                      </div>
                    )}
                  </section>
                </>
              ) : (
                <div className="baseline-next-action">
                  <div><b>Consolidar unidades y valor mensual</b><p>Aplicará las conversiones y precios aceptados sin alterar los archivos originales.</p></div>
                  <button className="primary" onClick={() => void calculatePlanResult()} disabled={calculatingResult}>{calculatingResult ? "Consolidando…" : "Calcular unidades y valor"}</button>
                </div>
              )}
            </div>
          )}
          {showVersionGate && planResult && profitability && (
            <div className="presentation-workspace">
              <div className="presentation-title">
                <div>
                  <p className="eyebrow">Vista para defender el Plan</p>
                  <h2>{selected.accountName ?? selected.accountId} · Plan {selected.year}</h2>
                  <p>Una lectura ejecutiva construida desde el mismo resultado persistido.</p>
                </div>
                <span className="status-chip">Versión {version?.number ?? 1} · Borrador</span>
              </div>
              {syntheticPackage && (
                <div className="synthetic-banner">
                  <b>DATOS SINTÉTICOS — NO COMERCIALES</b>
                  <span>Esta presentación prueba el recorrido y no puede enviarse como Plan comercial oficial.</span>
                </div>
              )}
              <div className="presentation-hero">
                <article><span>Revenue del Plan</span><b>{planResult.annualValue.toLocaleString("es-MX", { style: "currency", currency: planResult.currency, maximumFractionDigits: 0 })}</b><small>{planResult.currency} · año {selected.year}</small></article>
                <article><span>Unidades del Plan</span><b>{planResult.annualUnits.toLocaleString("es-MX")}</b><small>Base + incremental neto</small></article>
                <article><span>Incremental neto</span><b>+{growth?.netUnits.toLocaleString("es-MX")}</b><small>Marketing y Trade Marketing</small></article>
                <article><span>Margen bruto</span><b>{((profitability.planAnnual.grossMarginRate ?? 0) * 100).toFixed(1)}%</b><small>Parámetros sintéticos visibles</small></article>
                <article><span>Contribución</span><b>{profitability.planAnnual.contribution.toLocaleString("es-MX", { style: "currency", currency: profitability.currency, maximumFractionDigits: 0 })}</b><small>{((profitability.planAnnual.contributionRate ?? 0) * 100).toFixed(1)}% del net sales</small></article>
              </div>
              <div className="presentation-story">
                <div>
                  <p className="eyebrow">Historia del Plan</p>
                  <h3>La base aprobada se convierte en crecimiento rentable y reconciliado</h3>
                  <p>El Plan parte de {baselineReview?.approvedAnnualUnits?.toLocaleString("es-MX")} unidades de base, incorpora {growth?.netUnits.toLocaleString("es-MX")} unidades incrementales netas y llega a {planResult.annualUnits.toLocaleString("es-MX")} unidades anuales.</p>
                </div>
                <dl>
                  <div><dt>Comparador financiero</dt><dd>{profitability.comparator.name}</dd></div>
                  <div><dt>Reconciliación</dt><dd>{profitability.controls.planReconciled ? "Completa" : "Pendiente"}</dd></div>
                  <div><dt>Datos</dt><dd>Sintéticos, aislados y no oficializables</dd></div>
                </dl>
              </div>
              <div className="presentation-checklist">
                <div><span>✓</span><b>Baseline aprobado</b></div>
                <div><span>✓</span><b>Crecimiento reconciliado</b></div>
                <div><span>✓</span><b>Unidades y valor reconciliados</b></div>
                <div><span>✓</span><b>P&L comparado</b></div>
                <div className="blocked"><span>!</span><b>Oficialización bloqueada por ser sintético</b></div>
              </div>
              <div className="presentation-actions">
                <button className="secondary" onClick={() => setPresentationMode(true)}>Presentar en pantalla completa</button>
                <button
                  className="primary"
                  disabled={syntheticPackage || submittingPlan || version?.status === "SUBMITTED"}
                  aria-describedby={syntheticPackage ? "synthetic-submit-help" : undefined}
                  onClick={() => void submitPlanForReview(syntheticPackage)}
                >
                  {submittingPlan ? "Enviando…" : version?.status === "SUBMITTED" ? "Enviado a revisión" : "Enviar a revisión"}
                </button>
              </div>
              {submissionMessage && <p className="presentation-submit-help" role="status">{submissionMessage}</p>}
              {syntheticPackage && (
                <p className="presentation-submit-help" id="synthetic-submit-help">
                  El envío aparece en su lugar definitivo, pero permanece bloqueado porque este Plan utiliza datos sintéticos.
                </p>
              )}
              {presentationMode && (
                <div className="plan-presentation-mode" role="dialog" aria-modal="true" aria-label="Presentación del Plan">
                  <header>
                    <div><b>REVENUE</b><span>{selected.accountName ?? selected.accountId} · Plan {selected.year}</span></div>
                    <button onClick={() => setPresentationMode(false)}>Cerrar presentación</button>
                  </header>
                  <main>
                    <p>PLAN ANUAL · VERSIÓN {version?.number ?? 1}</p>
                    <h2>La base aprobada se convierte en crecimiento rentable y reconciliado</h2>
                    <div>
                      <article><span>Revenue del Plan</span><b>{planResult.annualValue.toLocaleString("es-MX", { style: "currency", currency: planResult.currency, maximumFractionDigits: 0 })}</b></article>
                      <article><span>Unidades del Plan</span><b>{planResult.annualUnits.toLocaleString("es-MX")}</b></article>
                      <article><span>Contribución</span><b>{profitability.planAnnual.contribution.toLocaleString("es-MX", { style: "currency", currency: profitability.currency, maximumFractionDigits: 0 })}</b></article>
                    </div>
                    {syntheticPackage && <strong>DATOS SINTÉTICOS — NO COMERCIALES</strong>}
                  </main>
                  <footer><span>Resumen ejecutivo · 1 de 5</span><button>Siguiente →</button></footer>
                </div>
              )}
            </div>
          )}
          {!showBaselineGate && !showGrowthGate && !showResultGate && !showVersionGate && (
            <>
          <section className="plan-overview" aria-label="Resumen integral del Plan">
            <div className="plan-overview-head">
              <div>
                <p className="eyebrow">{syntheticPackage ? "Plan piloto · lectura integral" : "Resumen del Plan"}</p>
                <h2>{planResult ? "Este es tu Plan anual" : "Construye el Plan desde una sola historia"}</h2>
                <p>{planResult
                  ? "La base, el crecimiento, las unidades, el valor y la rentabilidad están conectados en el mismo resultado."
                  : "Completa la información necesaria; cada resultado aparecerá aquí sin perder el contexto comercial."}</p>
              </div>
              <div className="commercial-controls">
                <div>
                  <span>Lectura</span>
                  {(["Año", "Trimestre", "Mes"] as const).map((level) => (
                    <button key={level} className={periodLevel === level ? "active" : ""} onClick={() => setPeriodLevel(level)}>{level}</button>
                  ))}
                </div>
              </div>
            </div>
            {syntheticPackage && (
              <div className="synthetic-banner">
                <b>DATOS SINTÉTICOS — NO COMERCIALES</b>
                <span>Este Plan demuestra el recorrido. No representa venta, cuota, proyección ni compromiso.</span>
              </div>
            )}
            <div className="plan-overview-kpis">
              <article><span>Base aprobada</span><b>{baselineReview?.approvedAnnualUnits?.toLocaleString("es-MX") ?? baseline?.annualUnits.toLocaleString("es-MX") ?? "Pendiente"}</b><small>{baseline ? "unidades anuales" : "requiere información"}</small></article>
              <article><span>Incremental neto</span><b>{growth ? `+${growth.netUnits.toLocaleString("es-MX")}` : "Pendiente"}</b><small>{growth ? "Marketing + Trade Marketing" : "después de aprobar la base"}</small></article>
              <article className="primary-result"><span>Plan anual</span><b>{planResult?.annualUnits.toLocaleString("es-MX") ?? "Pendiente"}</b><small>{planResult ? "unidades reconciliadas" : "base + incremental neto"}</small></article>
              <article><span>Revenue del Plan</span><b>{planResult ? planResult.annualValue.toLocaleString("es-MX", { style: "currency", currency: planResult.currency, maximumFractionDigits: 0 }) : "Pendiente"}</b><small>{planResult ? `${planResult.currency} · precios aceptados` : "requiere unidades y precios"}</small></article>
              <article><span>Contribución</span><b>{profitability ? profitability.planAnnual.contribution.toLocaleString("es-MX", { style: "currency", currency: profitability.currency, maximumFractionDigits: 0 }) : "Pendiente"}</b><small>{profitability ? `${((profitability.planAnnual.contributionRate ?? 0) * 100).toFixed(1)}% del net sales` : "requiere rentabilidad"}</small></article>
            </div>
            <div className="commercial-bridge plan-visible-bridge">
              <article><span>1</span><b>Base desimpactada</b><small>{baseline ? `${baseline.annualUnits.toLocaleString("es-MX")} unidades calculadas` : "Lo recurrente antes de actividades"}</small></article>
              <strong>+</strong>
              <article><span>2</span><b>Marketing</b><small>{growth ? `${growth.activities.filter((item) => item.family === "MARKETING").length} actividad identificada` : "Actividades y aporte neto"}</small></article>
              <strong>+</strong>
              <article><span>3</span><b>Trade Marketing</b><small>{growth ? `${growth.activities.filter((item) => item.family === "TRADE_MARKETING").length} actividades identificadas` : "Promociones y ejecución"}</small></article>
              <strong>=</strong>
              <article className="result"><span>4</span><b>Plan</b><small>{planResult ? `${planResult.annualUnits.toLocaleString("es-MX")} unidades · resultado reconciliado` : "Unidades, valor y rentabilidad"}</small></article>
            </div>
            <div className="plan-status-line">
              <div><span>Información</span><b>{packageAccepted ? "Completa" : "Pendiente"}</b></div>
              <div><span>Baseline</span><b>{baselineReview?.status === "APPROVED_FROZEN" ? "Aprobado" : baseline ? "Por decidir" : "Pendiente"}</b></div>
              <div><span>Crecimiento</span><b>{growth?.controls.reconciled ? "Reconciliado" : "Pendiente"}</b></div>
              <div><span>Resultado</span><b>{planResult ? "Reconciliado" : "Pendiente"}</b></div>
              <div><span>Rentabilidad</span><b>{profitability ? "Calculada" : "Pendiente"}</b></div>
              <div><span>Versión</span><b>Pendiente</b></div>
            </div>
          </section>
          {!showInformation ? (
            <div className="next-gate-card">
              <div><span>2</span><div><b>Siguiente: preparar la información mínima</b><p>Revisa qué necesita REVENUE, para qué sirve y qué elementos bloquean el cálculo.</p></div></div>
              <button className="secondary" onClick={() => setShowInformation(true)}>Abrir checklist</button>
            </div>
          ) : (
            <div className="input-package">
              <div className="input-package-head">
                <div>
                  <p className="eyebrow">Centro de datos · versión 1</p>
                  <h2>Convierte tus archivos en información utilizable</h2>
                  <p>{receivedFiles.length
                    ? "REVENUE preserva el original, explica cómo lo interpretó y valida la información antes de calcular."
                    : "Empieza con el Excel de historia de ventas. No necesitas convertirlo ni cambiar sus encabezados."}</p>
                </div>
                <span className={essentialReady === 4 && packageIssues.length === 0 ? "pill good" : "pill danger"}>{essentialReady} de 4 esenciales listos</span>
              </div>
              <div className="data-center-principle">
                <span>01</span>
                <div>
                  <b>Lo más importante de REVENUE es la información</b>
                  <p>Sube el archivo que ya produce tu empresa. REVENUE localizará la tabla, propondrá equivalencias y separará el original del dataset que usará el Plan.</p>
                </div>
              </div>
              <div className="synthetic-package-card">
                <div>
                  <b>Continuar con un caso de prueba controlado</b>
                  <p>Crea cinco archivos reproducibles para demostrar el recorrido. Quedarán marcados como datos sintéticos no comerciales y reemplazarán los archivos actuales de este Plan.</p>
                </div>
                <button className="secondary" onClick={() => void loadSyntheticPackage()} disabled={loadingSynthetic}>
                  {loadingSynthetic ? "Preparando…" : "Usar paquete sintético"}
                </button>
              </div>
              {syntheticPackage && (
                <div className="synthetic-banner">
                  <b>DATOS SINTÉTICOS — NO COMERCIALES</b>
                  <span>Los cinco archivos de este paquete son artificiales y sólo pueden usarse para prueba.</span>
                </div>
              )}
              <div className="input-requirements">
                {PILOT_INPUT_REQUIREMENTS.map((requirement) => {
                  const item = inputPackage.items.find((candidate) => candidate.requirementId === requirement.id);
                  const received = receivedFiles.find((file) => file.requirementId === requirement.id);
                  return (
                    <article className="input-requirement" key={requirement.id}>
                      <span className={received?.status === "READY" ? "input-state ready" : "input-state"}>{received?.status === "READY" ? "✓" : "○"}</span>
                      <div>
                        <div className="requirement-title">
                          <b>{requirement.name}</b>
                          <small>{requirement.criticality === "ESSENTIAL" ? "Esencial" : "Condicional"}</small>
                        </div>
                        <p>{requirement.purpose}</p>
                        <dl>
                          <div><dt>Responsable sugerido</dt><dd>{requirement.suggestedOwner}</dd></div>
                          <div><dt>Detalle esperado</dt><dd>{requirement.expectedGrain}</dd></div>
                          <div><dt>Cobertura mínima</dt><dd>{requirement.minimumCoverage}</dd></div>
                        </dl>
                        {received && (
                          <div className={received.status === "READY" ? "file-result ready" : "file-result incomplete"}>
                            <b>{received.originalName}</b>
                            <span>
                              {received.status === "READY"
                                ? `${received.summary.rowCount} filas revisadas sin errores bloqueantes.`
                                : received.issues.map((issue) =>
                                    `${issue.message}${issue.rows?.length ? ` Filas: ${issue.rows.join(", ")}.` : ""}`,
                                  ).join(" ")}
                            </span>
                          </div>
                        )}
                        {received?.summary.workbook && (
                          <div className="workbook-analysis">
                            <div className="workbook-analysis-head">
                              <div>
                                <small>Hoja elegida</small>
                                <b>{received.summary.workbook.selectedSheet ?? "Sin identificar"}</b>
                              </div>
                              <div>
                                <small>Encabezados</small>
                                <b>{received.summary.workbook.headerRow ? `Fila ${received.summary.workbook.headerRow}` : "Pendientes"}</b>
                              </div>
                              <div>
                                <small>Confianza</small>
                                <b>{received.summary.workbook.confidence}%</b>
                              </div>
                              <div>
                                <small>Cobertura</small>
                                <b>{received.summary.workbook.coverageMonths !== undefined ? `${received.summary.workbook.coverageMonths} meses` : `${received.summary.workbook.allocatedUnits?.toLocaleString("es-MX") ?? 0} unidades asignadas`}</b>
                              </div>
                            </div>
                            <p className="workbook-sheets">
                              Hojas encontradas: {received.summary.workbook.sheetNames.join(", ")}
                            </p>
                            <div className="mapping-grid">
                              {Object.entries(requirement.id === "sales-history" ? salesFieldLabels : Object.fromEntries(Object.keys(received.summary.workbook.mapping).map((field) => [field, field.replaceAll("_", " ") ]))).map(([field, label]) => (
                                <div key={field}>
                                  <span>{label}</span>
                                  <b>{received.summary.workbook?.mapping[field as keyof typeof salesFieldLabels] ?? "No identificado"}</b>
                                </div>
                              ))}
                            </div>
                            {requirement.id === "sales-history" && received.summary.workbook.preview.length > 0 && (
                              <div className="canonical-preview">
                                <div className="canonical-preview-head">
                                  <b>Vista del dataset canónico</b>
                                  <span>{received.summary.workbook.validRowCount} filas válidas · {received.summary.workbook.rejectedRowCount} rechazadas</span>
                                </div>
                                <div className="canonical-table">
                                  <div className="canonical-row heading">
                                    <span>Cuenta</span><span>SKU</span><span>Periodo</span><span>Unidades</span><span>Valor</span><span>Moneda</span>
                                  </div>
                                  {received.summary.workbook.preview.map((row, index) => (
                                    <div className="canonical-row" key={`${row.account_id}-${row.sku_id}-${row.period}-${index}`}>
                                      <span>{row.account_id}</span><span>{row.sku_id}</span><span>{row.period}</span>
                                      <span>{row.units.toLocaleString("es-MX")}</span>
                                      <span>{row.value.toLocaleString("es-MX")}</span><span>{row.currency}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="input-upload">
                        <strong>{received?.status === "READY" ? "Estructura lista" : received ? "Incompleto" : item?.status === "NOT_RECEIVED" ? "No recibido" : item?.status}</strong>
                        <button
                          type="button"
                          className="template-button"
                          onClick={() => downloadTemplate(requirement)}
                        >
                          ↓ Descargar plantilla
                        </button>
                        <label className="secondary file-button">
                          {uploadingRequirement === requirement.id
                            ? "Leyendo archivo…"
                            : ["sales-history","marketing-plan","trade-marketing-plan"].includes(requirement.id)
                              ? received ? "Reemplazar Excel o CSV" : "Seleccionar Excel o CSV"
                              : received ? "Reemplazar CSV" : "Seleccionar CSV"}
                          <input
                            type="file"
                            accept={["sales-history","marketing-plan","trade-marketing-plan"].includes(requirement.id)
                              ? ".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                              : ".csv,text/csv"}
                            disabled={uploadingRequirement === requirement.id}
                            onChange={(event) => void uploadInput(requirement.id, event.target.files?.[0])}
                          />
                        </label>
                      </div>
                    </article>
                  );
                })}
              </div>
              {packageIssues.length > 0 && (
                <div className="package-issues">
                  <b>Hay correspondencias pendientes entre archivos</b>
                  {packageIssues.map((issue) => <p key={issue.code}>{issue.message}</p>)}
                </div>
              )}
              {systemReady && !packageAccepted && (
                <div className="accept-package-card">
                  <div><b>Los cuatro insumos esenciales superaron los controles</b><p>Confirma el paquete para cerrar esta compuerta y habilitar Baseline.</p></div>
                  <button className="primary" onClick={() => void acceptInputPackage()} disabled={acceptingPackage}>
                    {acceptingPackage ? "Confirmando…" : "Confirmar paquete listo"}
                  </button>
                </div>
              )}
              {packageAccepted && (
                <div className="accepted-package-card">
                  <span>✓</span><div><b>Paquete aceptado</b><p>Cualquier archivo reemplazado volverá a abrir esta revisión.</p></div>
                </div>
              )}
              {!syntheticPackage && (
                <div className="input-package-warning">
                  <span>!</span>
                  <div><b>El archivo histórico disponible no completa este paquete</b><p>Está agregado por unidad de negocio y corresponde a 2010–2011; no incluye el detalle cuenta × SKU requerido para el piloto.</p></div>
                </div>
              )}
            </div>
          )}
            </>
          )}
        </section>
        <div className="sticky-actions empty-actions">
          <span>✓ Guardado durable · {baseline ? "baseline técnico persistido" : "ningún resultado ha sido calculado"}</span>
          <button className="secondary" onClick={() => onExit ? onExit() : (setView("portfolio"), void loadPlans())}>Volver al lobby</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page empty-plan-page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Planeación anual</p>
          <h1>Mis Planes</h1>
          <p>Crea un Plan nuevo o continúa exactamente donde lo dejaste.</p>
        </div>
        <button className="primary" onClick={() => setView("create")}>+ Crear Plan</button>
      </div>
      {error && <div className="recoverable-error" role="alert">{error}<button onClick={() => void loadPlans()}>Reintentar</button></div>}
      {loading ? (
        <section className="panel plans-loading" aria-live="polite">Buscando tus Planes guardados…</section>
      ) : plans.length === 0 ? (
        <section className="panel plans-empty-state">
          <span>▤</span>
          <h2>Aún no tienes Planes guardados</h2>
          <p>Empieza creando el contexto. No necesitas tener cifras ni archivos listos.</p>
          <button className="primary" onClick={() => setView("create")}>Crear mi primer Plan</button>
        </section>
      ) : (
        <section className="panel real-plan-list">
          <div className="panel-head"><div><p className="eyebrow">Trabajo guardado</p><h2>Continúa un Plan</h2></div><span className="count">{plans.length} {plans.length === 1 ? "Plan" : "Planes"}</span></div>
          {plans.map((plan) => {
            const version = activeVersion(plan);
            return (
              <button className="real-plan-row" key={plan.id} onClick={() => openPlan(plan)}>
                <div><b>{plan.accountName ?? plan.accountId}</b><small>{plan.companyName ?? plan.companyId} · Plan {plan.year}</small></div>
                <div><span>Versión</span><b>V{version?.number ?? 1}</b></div>
                <div><span>Estado</span><b>Borrador vacío</b></div>
                <div><span>Siguiente acción</span><b>Definir información</b></div>
                <strong>Continuar →</strong>
              </button>
            );
          })}
        </section>
      )}
    </div>
  );
}
