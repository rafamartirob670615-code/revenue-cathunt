"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import type { Plan } from "../../domain/types";
import { PILOT_INPUT_REQUIREMENTS } from "../../domain/input-package";
import MonitoringModule from "./MonitoringModule";
import Shell from "./Shell";
import HomeModule from "./HomeModule";
import {
  BaselineModule,
  ContextModule,
  GrowthPlanModule,
  InformationModule,
  ProfitabilityModule,
  ResultModule,
  ReviewModule,
} from "./PlanModules";
import type {
  BaselineResult,
  BaselineReview,
  Contribution,
  GrowthResult,
  PlanResult,
  ProfitabilityResult,
  ReceivedFile,
} from "./model";
import type { RevenueModule } from "./modules";
import { EmptyAnswer, ModuleHead } from "./ui";
import type { RevenueIdentity } from "./access";
import type { AlfaUniverseAccount } from "../../domain/alfa-turmix-monitoring";
import AlfaTurmixMonitor from "./AlfaTurmixMonitor";

const emptyPlanState = {
  files: [] as ReceivedFile[],
  accepted: false,
  systemReady: false,
  packageIssues: [] as Array<{ code: string; message: string }>,
  baseline: null as BaselineResult | null,
  review: null as BaselineReview | null,
  growth: null as GrowthResult | null,
  result: null as PlanResult | null,
  profitability: null as ProfitabilityResult | null,
  contributions: [] as Contribution[],
};

function friendly(message?: string) {
  if (/Autenticación/.test(message ?? "")) return "La sesión privada no está disponible. Actualiza la página.";
  return message || "No pudimos completar la acción. Tu trabajo guardado no se perdió.";
}

export default function RevenuePlatform({ identity, initialModule = "inicio" }: { identity: RevenueIdentity; initialModule?: RevenueModule }) {
  const [effectiveIdentity, setEffectiveIdentity] = useState(identity);
  const [active, setActive] = useState<RevenueModule>(initialModule);
  const [selected, setSelected] = useState<Plan | null>(null);
  const [state, setState] = useState(emptyPlanState);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [creating, setCreating] = useState(false);
  const [canonicalAccounts, setCanonicalAccounts] = useState<AlfaUniverseAccount[]>([]);

  const loadHome = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [accessResponse, accountsResponse] = await Promise.all([
        fetch("/api/access", { cache: "no-store" }),
        fetch("/api/canonical/accounts", { cache: "no-store" }),
      ]);
      const accessBody = await accessResponse.json() as { ok: boolean; identity?: RevenueIdentity };
      if (accessResponse.ok && accessBody.ok && accessBody.identity) setEffectiveIdentity(accessBody.identity);
      const accountsBody = await accountsResponse.json() as { ok: boolean; accounts?: AlfaUniverseAccount[]; error?: string };
      if (!accountsResponse.ok || !accountsBody.ok || !accountsBody.accounts?.length) {
        throw new Error(accountsBody.error || "CANÓNICOS no devolvió cuentas utilizables.");
      }
      setCanonicalAccounts(accountsBody.accounts);
    } catch (cause) {
      setError(friendly(cause instanceof Error ? cause.message : ""));
    } finally {
      setLoading(false);
    }
  }, []);

  // The effect initiates an asynchronous request; the request callbacks update the view state.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadHome(); }, [loadHome]);

  // La ruta /monitoring también debe conservar el Shell y su navegación lateral.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setActive(initialModule); }, [initialModule]);

  async function loadPlan(plan: Plan, destination?: RevenueModule) {
    setSelected(plan);
    setState(emptyPlanState);
    setBusy("Abriendo el Plan…");
    setError("");
    try {
      const inputsResponse = await fetch(`/api/inputs?planId=${encodeURIComponent(plan.id)}`, { cache: "no-store" });
      const inputs = await inputsResponse.json() as { ok: boolean; files?: ReceivedFile[]; accepted?: boolean; systemReady?: boolean; packageIssues?: Array<{ code: string; message: string }> };
      if (!inputsResponse.ok || !inputs.ok) throw new Error("No pudimos recuperar la información del Plan.");
      const next = {
        ...emptyPlanState,
        files: inputs.files ?? [],
        accepted: inputs.accepted ?? false,
        systemReady: inputs.systemReady ?? false,
        packageIssues: inputs.packageIssues ?? [],
      };
      const contributionResponse = await fetch(`/api/contributions?planId=${encodeURIComponent(plan.id)}`, { cache: "no-store" });
      const contributionBody = await contributionResponse.json() as { ok: boolean; contributions?: Contribution[] };
      if (contributionResponse.ok && contributionBody.ok) next.contributions = contributionBody.contributions ?? [];
      if (next.accepted) {
        const baselineResponse = await fetch(`/api/baseline?planId=${encodeURIComponent(plan.id)}`, { cache: "no-store" });
        const baseline = await baselineResponse.json() as { ok: boolean; result?: BaselineResult | null; review?: BaselineReview | null };
        if (baselineResponse.ok && baseline.ok) {
          next.baseline = baseline.result ?? null;
          next.review = baseline.review ?? null;
        }
      }
      if (next.review?.status === "APPROVED_FROZEN") {
        const growthResponse = await fetch(`/api/growth?planId=${encodeURIComponent(plan.id)}`, { cache: "no-store" });
        const body = await growthResponse.json() as { ok: boolean; result?: GrowthResult | null };
        if (growthResponse.ok && body.ok) next.growth = body.result ?? null;
      }
      if (next.growth?.controls.reconciled) {
        const response = await fetch(`/api/result?planId=${encodeURIComponent(plan.id)}`, { cache: "no-store" });
        const body = await response.json() as { ok: boolean; result?: PlanResult | null };
        if (response.ok && body.ok) next.result = body.result ?? null;
      }
      if (next.result?.controls.unitsReconciled && next.result.controls.valueReconciled) {
        const response = await fetch(`/api/profitability?planId=${encodeURIComponent(plan.id)}`, { cache: "no-store" });
        const body = await response.json() as { ok: boolean; result?: ProfitabilityResult | null };
        if (response.ok && body.ok) next.profitability = body.result ?? null;
      }
      setState(next);
      const nextModule: RevenueModule =
        next.profitability ? "revision" :
        next.result ? "rentabilidad" :
        next.growth?.controls.reconciled ? "plan-anual" :
        next.review?.status === "APPROVED_FROZEN" ? "plan-marketing" :
        next.accepted ? "volumen-base" :
        "informacion";
      setActive(destination ?? nextModule);
    } catch (cause) {
      setError(friendly(cause instanceof Error ? cause.message : ""));
      setActive("informacion");
    } finally {
      setBusy("");
    }
  }

  const completed = useMemo(() => {
    const modules = new Set<RevenueModule>();
    if (selected) modules.add("contexto");
    if (state.accepted) modules.add("informacion");
    if (state.review?.status === "APPROVED_FROZEN") modules.add("volumen-base");
    if (state.growth?.activities.some((activity) => activity.family === "MARKETING")) modules.add("plan-marketing");
    if (state.growth?.activities.some((activity) => activity.family === "TRADE_MARKETING")) modules.add("plan-trade");
    if (state.result?.controls.unitsReconciled) modules.add("plan-anual");
    if (state.profitability?.controls.planReconciled) modules.add("rentabilidad");
    if (state.profitability) modules.add("revision");
    if (selected && ["SUBMITTED","COMMERCIAL_APPROVED","OFFICIAL"].includes(selected.versions.at(-1)?.status ?? "")) modules.add("monitoreo");
    return modules;
  }, [selected, state]);

  async function upload(requirementId: string, file?: File, destination?: RevenueModule) {
    if (!selected || !file) return;
    setBusy(requirementId);
    setError("");
    try {
      const form = new FormData();
      form.set("planId", selected.id);
      form.set("requirementId", requirementId);
      form.set("file", file);
      const response = await fetch("/api/inputs", { method: "POST", body: form });
      const body = await response.json() as { ok: boolean; result?: ReceivedFile; error?: string };
      if (!response.ok || !body.ok) throw new Error(body.error);
      await loadPlan(selected);
      setActive(destination ?? "informacion");
    } catch (cause) {
      setError(friendly(cause instanceof Error ? cause.message : ""));
    } finally {
      setBusy("");
    }
  }

  async function guidedCapture(requirementId: string, values: { account: string; product: string; period: string; units: string; value: string; currency: string; evidence: string }) {
    const requirement = PILOT_INPUT_REQUIREMENTS.find((item) => item.id === requirementId);
    if (!selected || !requirement) return;
    const number = (value: string) => value || "0";
    const row: Record<string, string> = {
      account_id: values.account,
      sku_id: values.product,
      period: values.period,
      units: number(values.units),
      value: number(values.value),
      currency: values.currency,
      source_type: "ACCOUNT_PRODUCT",
      source_code: values.product,
      canonical_id: values.product,
      canonical_name: values.product,
      source_unit: "UNIDAD",
      base_unit: "UNIDAD",
      conversion_factor: "1",
      valid_from: values.period,
      price: number(values.value),
      price_type: "NET",
      activity_id: `GUIADA-${requirementId}`,
      activity_name: "Captura guiada",
      activity_type: requirementId === "marketing-plan" ? "BRAND_ACTIVITY" : "EXECUTION",
      start_period: values.period,
      end_period: values.period,
      corporate_gross_units: number(values.units),
      allocation_share: "1",
      cannibalization_units: "0",
      halo_units: "0",
      pull_forward_units: "0",
      interaction_units: "0",
      evidence: values.evidence || "Captura guiada",
      discount_rate: "0",
      rebate_rate: "0",
      returns_rate: "0",
      other_deduction_rate: "0",
      unit_cost: number(values.value),
      period_cutoff: values.period,
      cutoff_date: `${values.period}-01`,
      actual_units: number(values.units),
      actual_value: number(values.value),
      quota_value: number(values.value),
      investment_value: "0",
    };
    const headers = [...requirement.requiredFields];
    const rows = [headers, headers.map((header) => row[header] ?? "")];
    const excelRequirement = new Set(["marketing-plan", "trade-marketing-plan", "commercial-conditions", "product-costs", "activity-investments", "sales-quota", "actual-sales"]);
    if (excelRequirement.has(requirementId)) {
      const sheet = XLSX.utils.aoa_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, "Captura guiada");
      const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      await upload(requirementId, new File([bytes], `CAPTURA_GUIADA_${requirementId}.xlsx`, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    } else {
      const csv = rows.map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
      await upload(requirementId, new File([csv], `CAPTURA_GUIADA_${requirementId}.csv`, { type: "text/csv;charset=utf-8" }));
    }
  }

  async function acceptInformation() {
    if (!selected) return;
    const accepted = await run("Aceptando información…", "/api/inputs", "PATCH", () => setState((current) => ({ ...current, accepted: true })));
    if (accepted) setActive("volumen-base");
  }

  async function run(label: string, url: string, method: string, apply: (result: unknown) => void) {
    if (!selected) return false;
    setBusy(label);
    setError("");
    try {
      const response = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify({ planId: selected.id }) });
      const body = await response.json() as { ok: boolean; result?: unknown; review?: unknown; error?: string };
      if (!response.ok || !body.ok) throw new Error(body.error);
      apply(body.result ?? body.review);
      return true;
    } catch (cause) {
      setError(friendly(cause instanceof Error ? cause.message : ""));
      return false;
    } finally {
      setBusy("");
    }
  }

  async function calculateBaseline() {
    await run("Calculando volumen base…", "/api/baseline", "POST", (result) => setState((current) => ({ ...current, baseline: result as BaselineResult, review: null })));
  }
  async function approveBaseline() {
    if (!selected) return;
    setBusy("Aprobando volumen base…");
    try {
      const response = await fetch("/api/baseline", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ planId: selected.id, decision: "CALCULATED" }) });
      const body = await response.json() as { ok: boolean; review?: BaselineReview; error?: string };
      if (!response.ok || !body.ok || !body.review) throw new Error(body.error);
      setState((current) => ({ ...current, review: body.review ?? null }));
      setActive("plan-marketing");
    } catch (cause) { setError(friendly(cause instanceof Error ? cause.message : "")); }
    finally { setBusy(""); }
  }
  async function buildGrowth() {
    await run("Construyendo crecimiento…", "/api/growth", "POST", (result) => setState((current) => ({ ...current, growth: result as GrowthResult, result: null, profitability: null })));
  }
  async function createContribution(event: React.FormEvent<HTMLFormElement>, businessFunction: "MARKETING" | "TRADE_MARKETING") {
    if (!selected) return;
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy("Guardando aportación…");
    setError("");
    try {
      const response = await fetch("/api/contributions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          planId: selected.id,
          businessFunction,
          lever: form.get("lever"),
          title: form.get("title"),
          assumptionQuality: form.get("assumptionQuality"),
          periodStart: form.get("periodStart"),
          periodEnd: form.get("periodEnd"),
          productScope: form.get("productScope"),
          grossUnits: Number(form.get("grossUnits")),
          investmentAmount: Number(form.get("investmentAmount")),
          currency: selected.currency,
          evidence: form.get("evidence"),
        }),
      });
      const body = await response.json() as { ok: boolean; error?: string };
      if (!response.ok || !body.ok) throw new Error(body.error);
      formElement.reset();
      await loadPlan(selected, businessFunction === "MARKETING" ? "plan-marketing" : "plan-trade");
    } catch (cause) {
      setError(friendly(cause instanceof Error ? cause.message : ""));
    } finally { setBusy(""); }
  }
  async function decideContribution(id: string, status: "ACCEPTED" | "RETURNED", destination: RevenueModule) {
    if (!selected) return;
    setBusy("Guardando decisión…");
    try {
      const response = await fetch("/api/contributions", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId: selected.id, id, status }),
      });
      const body = await response.json() as { ok: boolean; error?: string };
      if (!response.ok || !body.ok) throw new Error(body.error);
      await loadPlan(selected, destination);
    } catch (cause) { setError(friendly(cause instanceof Error ? cause.message : "")); }
    finally { setBusy(""); }
  }
  async function buildResult() {
    await run("Consolidando Plan…", "/api/result", "POST", (result) => setState((current) => ({ ...current, result: result as PlanResult, profitability: null })));
  }
  async function buildProfitability() {
    await run("Calculando rentabilidad…", "/api/profitability", "POST", (result) => setState((current) => ({ ...current, profitability: result as ProfitabilityResult })));
  }
  async function submit() {
    if (!selected) return;
    const version = selected.versions.at(-1);
    if (!version) return;
    setBusy("Enviando a revisión…");
    try {
      const response = await fetch("/api/plans", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "freezeAndSubmit", planId: selected.id, versionId: version.id, context: { commandId: `submit:${crypto.randomUUID()}`, actorId: "authenticated-user", occurredAt: new Date().toISOString() } }) });
      const body = await response.json() as { ok: boolean; result?: { version: Plan["versions"][number] }; error?: string };
      if (!response.ok || !body.ok || !body.result) throw new Error(body.error);
      setSelected({ ...selected, versions: selected.versions.map((item) => item.id === body.result?.version.id ? body.result.version : item) });
      setNotice(`Versión V${body.result.version.number} guardada y enviada a revisión. Puedes seguir consultándola en Seguimiento.`);
      setActive("monitoreo");
    } catch (cause) { setError(friendly(cause instanceof Error ? cause.message : "")); }
    finally { setBusy(""); }
  }

  async function createPlan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const companyName = String(form.get("company") ?? "").trim();
    const accountId = String(form.get("accountId") ?? "").trim();
    const accountInput = String(form.get("account") ?? "").trim();
    const normalizedAccountInput = accountInput.trim().toLowerCase();
    const exactAccount = canonicalAccounts.find((account) => account.id === accountId || account.name.toLowerCase() === normalizedAccountInput);
    const matchingAccounts = canonicalAccounts.filter((account) => normalizedAccountInput && account.name.toLowerCase().includes(normalizedAccountInput));
    const selectedAccount = exactAccount ?? (matchingAccounts.length === 1 ? matchingAccounts[0] : undefined);
    if (!selectedAccount) {
      setError("Selecciona una cuenta existente del universo comercial o escribe su nombre completo.");
      return;
    }
    const accountName = selectedAccount.name;
    const year = Number(form.get("year"));
    const currency = String(form.get("currency") ?? "MXN");
    const occurredAt = new Date().toISOString();
    const plan: Plan = {
      id: `plan:${crypto.randomUUID()}`,
      organizationId: "revenue-pilot",
      companyId: companyName.toLowerCase().replace(/\s+/g, "-"),
      companyName,
      accountId: selectedAccount.id,
      accountName,
      year,
      currency,
      versions: [{ id: `version:${crypto.randomUUID()}`, planId: "", number: 1, kind: "PLAN", status: "DRAFT", createdBy: "authenticated-user", createdAt: occurredAt, lines: [], overrides: [], validations: [], approvals: [] }],
    };
    plan.versions[0].planId = plan.id;
    setBusy("Creando Plan…");
    try {
      const response = await fetch("/api/plans", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "create", plan, context: { commandId: `create:${crypto.randomUUID()}`, actorId: "authenticated-user", occurredAt } }) });
      const body = await response.json() as { ok: boolean; result?: Plan; error?: string };
      if (!response.ok || !body.ok || !body.result) throw new Error(body.error);
      setCreating(false);
      await loadPlan(body.result);
    } catch (cause) { setError(friendly(cause instanceof Error ? cause.message : "")); }
    finally { setBusy(""); }
  }

  function startCreate() {
    setSelected(null);
    setState(emptyPlanState);
    setCreating(true);
    setError("");
  }

  function navigate(module: RevenueModule) {
    // El menú lateral es persistente: cualquier destino debe cerrar el formulario
    // transitorio de creación para no dejar el contenido desfasado del módulo activo.
    setCreating(false);
    setActive(module);
  }

  const syntheticPlan =
    state.baseline?.dataClassification === "SYNTHETIC_NON_COMMERCIAL" ||
    (state.files.length > 0 && state.files.every((file) => file.synthetic));
  const marketingReady = state.files.some((file) => file.requirementId === "marketing-plan" && file.status === "READY");
  const tradeReady = state.files.some((file) => file.requirementId === "trade-marketing-plan" && file.status === "READY");
  const marketingContributionReady = state.contributions.some((item) => item.business_function === "MARKETING" && item.status === "ACCEPTED");
  const tradeContributionReady = state.contributions.some((item) => item.business_function === "TRADE_MARKETING" && item.status === "ACCEPTED");
  const growthCanBuild = state.review?.status === "APPROVED_FROZEN" && (
    syntheticPlan || ((marketingReady || marketingContributionReady) && (tradeReady || tradeContributionReady))
  );
  const growthWaitingFor = state.review?.status !== "APPROVED_FROZEN"
    ? "Primero aprueba el Volumen base."
    : !(marketingReady || marketingContributionReady)
      ? "Falta una aportación o archivo de Marketing."
      : !(tradeReady || tradeContributionReady)
        ? "Falta una aportación o archivo de Trade Marketing."
        : "Las fuentes están listas.";
  const can = (capability: RevenueIdentity["capabilities"][number]) => effectiveIdentity.capabilities.includes(capability);
  const canIntegrate = can("PLAN_INTEGRATE");
  const canContributeMarketing = can("MARKETING_CONTRIBUTE");
  const canContributeTrade = can("TRADE_CONTRIBUTE");
  const financeOnly = can("VIEW_FINANCIALS") && !canIntegrate && !can("REVIEW") && !can("APPROVE");

  return (
    <Shell active={active} plan={selected} identity={effectiveIdentity} completed={completed} onNavigate={navigate}>
      {error && <div className="platform-error" role="alert">{error}<button onClick={() => setError("")}>Cerrar</button></div>}
      {notice && <div className="answer-card good"><div><small>Registro de versión</small><p>{notice}</p></div><button className="paper-button" onClick={() => setNotice("")}>Cerrar</button></div>}
      {busy === "Abriendo el Plan…" || loading ? <div className="platform-loading"><span /><b>{busy || "Abriendo REVENUE…"}</b></div> :
      creating ? <CreatePlanModule accounts={canonicalAccounts} busy={busy} onSubmit={createPlan} onCancel={() => { setCreating(false); setActive("inicio"); }} /> :
      active === "inicio" ? <HomeModule canCreate={can("PLAN_CREATE") || can("PLAN_INTEGRATE")} onCreate={startCreate} onMonitor={() => setActive("monitoreo")} /> :
      active === "contexto" ? selected ? <ContextModule plan={selected} /> : <NoPlan onCreate={startCreate} /> :
      active === "informacion" ? selected ? <InformationModule accounts={canonicalAccounts} files={state.files} accepted={state.accepted} systemReady={state.systemReady} busy={busy} onUpload={upload} onGuidedCapture={guidedCapture} onAccept={acceptInformation} /> : <NoPlan onCreate={startCreate} /> :
      active === "volumen-base" ? selected ? <BaselineModule baseline={state.baseline} review={state.review} ready={state.accepted} busy={busy} onCalculate={calculateBaseline} onApprove={approveBaseline} /> : <NoPlan onCreate={startCreate} /> :
      active === "plan-marketing" ? selected ? <GrowthPlanModule family="MARKETING" plan={selected} contributions={state.contributions} growth={state.growth} source={state.files.find((file) => file.requirementId === "marketing-plan")} synthetic={syntheticPlan} canBuild={growthCanBuild && canIntegrate} canContribute={canContributeMarketing} canIntegrate={canIntegrate} waitingFor={growthWaitingFor} busy={busy} onUpload={upload} onBuild={buildGrowth} onContribute={createContribution} onDecide={(id,status) => decideContribution(id,status,"plan-marketing")} /> : <NoPlan onCreate={startCreate} /> :
      active === "plan-trade" ? selected ? <GrowthPlanModule family="TRADE_MARKETING" plan={selected} contributions={state.contributions} growth={state.growth} source={state.files.find((file) => file.requirementId === "trade-marketing-plan")} synthetic={syntheticPlan} canBuild={growthCanBuild && canIntegrate} canContribute={canContributeTrade} canIntegrate={canIntegrate} waitingFor={growthWaitingFor} busy={busy} onUpload={upload} onBuild={buildGrowth} onContribute={createContribution} onDecide={(id,status) => decideContribution(id,status,"plan-trade")} /> : <NoPlan onCreate={startCreate} /> :
      active === "plan-anual" ? selected ? <ResultModule result={state.result} baselineUnits={state.review?.approvedAnnualUnits ?? state.baseline?.annualUnits ?? 0} growthUnits={state.growth?.netUnits ?? 0} growth={state.growth} ready={Boolean(state.growth?.controls.reconciled)} busy={busy} onBuild={buildResult} /> : <NoPlan onCreate={startCreate} /> :
      active === "rentabilidad" ? selected ? <ProfitabilityModule profitability={state.profitability} files={state.files} onUpload={(requirementId, file) => upload(requirementId, file, "rentabilidad")} ready={!financeOnly && Boolean(state.result?.controls.unitsReconciled && state.result.controls.valueReconciled)} busy={busy} onBuild={buildProfitability} readOnly={financeOnly} /> : <NoPlan onCreate={startCreate} /> :
      active === "revision" ? selected ? <ReviewModule baseline={state.review} baselineResult={state.baseline} growth={state.growth} result={state.result} profitability={state.profitability} synthetic={syntheticPlan} busy={busy} onSubmit={submit} /> : <NoPlan onCreate={startCreate} /> :
      active === "monitoreo" ? selected ? <MonitoringModule planId={selected.id} /> : <AlfaTurmixMonitor /> :
      <AdministrationModule plan={selected} onChanged={loadHome} />}
    </Shell>
  );
}

function NoPlan({ onCreate }: { onCreate: () => void }) {
  return <div className="module-page"><ModuleHead eyebrow="Información" title="Primero selecciona o crea un Plan" description="El contexto de compañía, cuenta, año y versión gobierna toda la información." /><EmptyAnswer title="No hay una cuenta activa" copy="Registra el contexto una sola vez y REVENUE lo conservará durante todo el recorrido." action={<button className="clay-primary" onClick={onCreate}>Crear un Plan</button>} /></div>;
}

function CreatePlanModule({ accounts, busy, onSubmit, onCancel }: { accounts: AlfaUniverseAccount[]; busy: string; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void; onCancel: () => void }) {
  return <div className="module-page"><ModuleHead eyebrow="Nuevo Plan" title="Registra el contexto una sola vez" description="Elige una cuenta del universo comercial o búscala escribiendo. El identificador técnico se conserva en el sistema y no necesitas capturarlo." /><section className="plain-note"><b>Cuenta existente</b><p>La cuenta no se crea como texto libre: debe coincidir con CANÓNICOS para que Monitoreo, responsables y Billing compartan la misma clave.</p></section><form className="paper-panel create-paper-form" onSubmit={onSubmit}><label>Compañía<input name="company" required placeholder="Ej. Turmix de México" /></label><label>Cuenta<input name="account" required list="revenue-account-options" placeholder="Busca por nombre, por ejemplo Liverpool" /><datalist id="revenue-account-options">{accounts.map((account) => <option key={account.id} value={account.name}>{account.id} · {account.territory} · {account.channel}</option>)}</datalist></label><label>Año del Plan<input name="year" required type="number" min="2026" defaultValue="2027" /></label><label>Moneda<select name="currency" defaultValue="MXN"><option>MXN</option><option>USD</option></select></label><div><button type="button" className="paper-button" onClick={onCancel}>Cancelar</button><button className="clay-primary" disabled={Boolean(busy) || accounts.length === 0}>{busy || "Guardar y continuar"}</button></div></form></div>;
}

function AdministrationModule({ plan, onChanged }: { plan: Plan | null; onChanged: () => Promise<void> }) {
  const [assignments, setAssignments] = useState<Array<Record<string,string>>>([]);
  const [adminPlans, setAdminPlans] = useState<Array<{ id: string; account: string; company: string; year: number }>>([]);
  const [targetPlanId, setTargetPlanId] = useState(plan?.id ?? "");
  const [message, setMessage] = useState("");
  const [configuration, setConfiguration] = useState<Record<string,string>>({});
  const load = useCallback(async () => {
    const selectedPlanId = plan?.id ?? "";
    const response = await fetch(selectedPlanId ? `/api/admin/access?planId=${encodeURIComponent(selectedPlanId)}` : "/api/admin/access", { cache: "no-store" });
    const body = await response.json() as { ok: boolean; assignments?: Array<Record<string,string>>; users?: Array<Record<string,string>>; plans?: Array<{ id: string; account: string; company: string; year: number }>; configuration?: Record<string,string>; error?: string };
    if (response.ok && body.ok) {
      setAssignments(body.assignments ?? body.users ?? []);
      setAdminPlans(body.plans ?? []);
      setConfiguration(body.configuration ?? {});
    }
    else setMessage(body.error ?? "No pudimos recuperar los accesos.");
  }, [plan]);
  // The effect initiates an asynchronous request; the request callbacks update the view state.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);
  async function grant(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const selectedPlanId = plan?.id ?? String(form.get("planId") ?? targetPlanId);
    const capability = String(form.get("capability") ?? "");
    const response = await fetch("/api/admin/access", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ planId: capability === "ADMINISTER_ACCESS" ? "" : selectedPlanId, email: form.get("email"), displayName: form.get("displayName"), capability }),
    });
    const body = await response.json() as { ok: boolean; error?: string };
    setMessage(response.ok && body.ok ? "Acceso concedido para esta cuenta." : body.error ?? "No pudimos guardar el acceso.");
    if (response.ok && body.ok) { formElement.reset(); await load(); await onChanged(); }
  }
  async function revoke(item: Record<string,string>) {
    const response = await fetch("/api/admin/access", { method:"DELETE", headers:{ "content-type":"application/json" }, body:JSON.stringify({ planId:item.scope_type === "PLAN" ? (plan?.id ?? targetPlanId) : "", email:item.email, capability:item.capability }) });
    const body = await response.json() as { ok?: boolean; error?: string };
    setMessage(response.ok && body.ok ? "Acceso retirado." : body.error ?? "No pudimos retirar el acceso.");
    if (response.ok && body.ok) await load();
  }
  const activePlan = plan ?? adminPlans.find((item) => item.id === targetPlanId);
  const activeAccountName = plan?.accountName ?? adminPlans.find((item) => item.id === targetPlanId)?.account ?? "";
  return <div className="module-page"><ModuleHead eyebrow="Administración · sólo administrador" title="Usuarios, roles y configuración de REVENUE" description="Administra personas, responsables, cuentas y permisos. Monitoreo es transversal; Construcción sólo corresponde al responsable del Plan y a Administración." />
    <section className="admin-foundation"><article><b>Cuentas administrables</b><p>{adminPlans.length || (plan ? 1 : 0)} Planes disponibles para asignar.</p></article><article><b>Regla de acceso</b><p>Monitoreo: cualquier usuario autenticado. Construcción: responsable o administrador.</p></article><article><b>Responsabilidad</b><p>{activePlan ? `${activeAccountName} · ${activePlan.year}` : "Selecciona una cuenta para gestionar su equipo."}</p></article></section>
    {(!plan && adminPlans.length > 0) && <label className="admin-plan-picker">Cuenta / Plan<select value={targetPlanId} onChange={(event) => setTargetPlanId(event.target.value)}><option value="">Selecciona una cuenta</option>{adminPlans.map((item) => <option key={item.id} value={item.id}>{item.account} · {item.year}</option>)}</select></label>}
    {(plan || targetPlanId || !plan) ? <>
      {activePlan && <section className="plain-note"><b>{activeAccountName} · {plan?.companyName ?? adminPlans.find((item) => item.id === targetPlanId)?.company ?? ""} · {activePlan.year}</b><p>El administrador concede capacidades concretas para esta cuenta. Ser administrador no sustituye la revisión o aprobación comercial.</p></section>}
      <form className="contribution-builder access-form" onSubmit={grant}>
        {!plan && <label>Plan destino<select name="planId" value={targetPlanId} onChange={(event) => setTargetPlanId(event.target.value)}><option value="">Administración global</option>{adminPlans.map((item) => <option key={item.id} value={item.id}>{item.account} · {item.year}</option>)}</select><small>Déjalo en Administración global para administrar personas con acceso a toda la aplicación.</small></label>}
        <label>Nombre<input name="displayName" required placeholder="Nombre de la persona" /></label>
        <label>Correo del workspace<input name="email" type="email" required placeholder="persona@empresa.com" /></label>
        <label>Capacidad<select name="capability" required defaultValue=""><option value="" disabled>Selecciona</option><option value="ADMINISTER_ACCESS">Administrador global</option><option value="MARKETING_CONTRIBUTE">Aportar Marketing</option><option value="TRADE_CONTRIBUTE">Aportar Trade Marketing</option><option value="PLAN_INTEGRATE">Construir e integrar Plan</option><option value="REVIEW">Revisar comercialmente</option><option value="APPROVE">Aprobar comercialmente</option><option value="VIEW_FINANCIALS">Consultar Finanzas</option></select></label>
        <button className="clay-primary">Conceder acceso</button>
      </form>
      {message && <section className="plain-note"><p>{message}</p></section>}
      {Object.keys(configuration).length > 0 && <section className="admin-foundation">{Object.entries(configuration).map(([key,value]) => <article key={key}><b>{key.replaceAll(/([A-Z])/g," $1")}</b><p>{value.replaceAll("_"," ")}</p></article>)}</section>}
      <section className="contribution-register"><div className="section-title"><small>Acceso vigente</small><h2>Personas asignadas a esta cuenta</h2></div>{assignments.map((item, index) => <article key={`${item.email}:${item.capability}:${index}`}><div><b>{item.display_name}</b><span>{item.email}</span></div><div><strong>{String(item.capability).replaceAll("_"," ")}</strong><span>{item.business_function}</span></div><div><strong>{String(item.scope_type).startsWith("MONITOR_") ? String(item.scope_type).replace("MONITOR_", "Monitoreo · ") : "Plan completo"}</strong><span>{String(item.scope_id)}</span></div><button className="paper-button" onClick={() => revoke(item)}>Retirar</button></article>)}</section>
    </> : <EmptyAnswer title="No hay cuentas cargadas" copy="Crea el primer Plan para que el administrador pueda asignar responsables y capacidades." />}
  </div>;
}
