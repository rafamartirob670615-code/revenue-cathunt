"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Plan } from "../../domain/types";
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
  DashboardPlan,
  GrowthResult,
  PlanResult,
  ProfitabilityResult,
  ReceivedFile,
} from "./model";
import type { RevenueModule } from "./modules";
import { EmptyAnswer, ModuleHead } from "./ui";

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
};

function friendly(message?: string) {
  if (/Autenticación/.test(message ?? "")) return "La sesión privada no está disponible. Actualiza la página.";
  return message || "No pudimos completar la acción. Tu trabajo guardado no se perdió.";
}

export default function RevenuePlatform() {
  const [active, setActive] = useState<RevenueModule>("inicio");
  const [dashboardPlans, setDashboardPlans] = useState<DashboardPlan[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selected, setSelected] = useState<Plan | null>(null);
  const [state, setState] = useState(emptyPlanState);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const loadHome = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [dashboardResponse, plansResponse] = await Promise.all([
        fetch("/api/dashboard", { cache: "no-store" }),
        fetch("/api/plans", { cache: "no-store" }),
      ]);
      const dashboard = await dashboardResponse.json() as { ok?: boolean; plans?: DashboardPlan[]; error?: string };
      const planBody = await plansResponse.json() as { ok: boolean; plans?: Plan[]; error?: string };
      if (!dashboardResponse.ok) throw new Error(dashboard.error);
      if (!plansResponse.ok || !planBody.ok) throw new Error(planBody.error);
      setDashboardPlans(dashboard.plans ?? []);
      setPlans(planBody.plans ?? []);
    } catch (cause) {
      setError(friendly(cause instanceof Error ? cause.message : ""));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadHome(); }, [loadHome]);

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
      if (next.accepted) {
        const baselineResponse = await fetch(`/api/baseline?planId=${encodeURIComponent(plan.id)}`, { cache: "no-store" });
        const baseline = await baselineResponse.json() as { ok: boolean; result?: BaselineResult | null; review?: BaselineReview | null };
        if (baselineResponse.ok && baseline.ok) {
          next.baseline = baseline.result ?? null;
          next.review = baseline.review ?? null;
        }
      }
      if (next.review?.status === "APPROVED_FROZEN") {
        const response = await fetch(`/api/growth?planId=${encodeURIComponent(plan.id)}`, { cache: "no-store" });
        const body = await response.json() as { ok: boolean; result?: GrowthResult | null };
        if (response.ok && body.ok) next.growth = body.result ?? null;
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

  function openDashboardPlan(id: string, destination?: RevenueModule) {
    const plan = plans.find((item) => item.id === id);
    if (plan) void loadPlan(plan, destination);
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
    if (selected && ["SUBMITTED","COMMERCIAL_APPROVED","FINANCE_VALIDATED","OFFICIAL"].includes(selected.versions.at(-1)?.status ?? "")) modules.add("monitoreo");
    return modules;
  }, [selected, state]);

  async function upload(requirementId: string, file?: File) {
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
      setActive("informacion");
    } catch (cause) {
      setError(friendly(cause instanceof Error ? cause.message : ""));
    } finally {
      setBusy("");
    }
  }

  async function acceptInformation() {
    if (!selected) return;
    const accepted = await run("Aceptando información…", "/api/inputs", "PATCH", () => setState((current) => ({ ...current, accepted: true })));
    if (accepted) setActive("volumen-base");
  }

  async function synthetic() {
    if (!selected) return;
    setBusy("Preparando prueba guiada…");
    setError("");
    try {
      for (const [url, method] of [["/api/inputs","PUT"],["/api/inputs","PATCH"],["/api/baseline","POST"]] as const) {
        const response = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify({ planId: selected.id }) });
        const body = await response.json() as { ok: boolean; error?: string };
        if (!response.ok || !body.ok) throw new Error(body.error);
      }
      await loadPlan(selected);
      setActive("volumen-base");
    } catch (cause) {
      setError(friendly(cause instanceof Error ? cause.message : ""));
    } finally {
      setBusy("");
    }
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
      setActive("monitoreo");
    } catch (cause) { setError(friendly(cause instanceof Error ? cause.message : "")); }
    finally { setBusy(""); }
  }

  async function createPlan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const companyName = String(form.get("company") ?? "").trim();
    const accountName = String(form.get("account") ?? "").trim();
    const year = Number(form.get("year"));
    const currency = String(form.get("currency") ?? "MXN");
    const occurredAt = new Date().toISOString();
    const plan: Plan = {
      id: `plan:${crypto.randomUUID()}`,
      organizationId: "revenue-pilot",
      companyId: companyName.toLowerCase().replace(/\s+/g, "-"),
      companyName,
      accountId: accountName.toLowerCase().replace(/\s+/g, "-"),
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
      setPlans((current) => [body.result!, ...current]);
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
    if (module === "inicio") { setActive("inicio"); setCreating(false); }
    else setActive(module);
  }

  const syntheticPlan = state.files.length > 0 && state.files.every((file) => file.synthetic);
  const marketingReady = state.files.some((file) => file.requirementId === "marketing-plan" && file.status === "READY");
  const tradeReady = state.files.some((file) => file.requirementId === "trade-marketing-plan" && file.status === "READY");
  const growthCanBuild = state.review?.status === "APPROVED_FROZEN" && (syntheticPlan || (marketingReady && tradeReady));
  const growthWaitingFor = state.review?.status !== "APPROVED_FROZEN"
    ? "Primero aprueba el Volumen base."
    : !marketingReady
      ? "Falta el Plan de Marketing."
      : !tradeReady
        ? "Falta el Plan de Trade Marketing."
        : "Las fuentes están listas.";

  return (
    <Shell active={active} plan={selected} completed={completed} onNavigate={navigate}>
      {error && <div className="platform-error" role="alert">{error}<button onClick={() => setError("")}>Cerrar</button></div>}
      {busy === "Abriendo el Plan…" || loading ? <div className="platform-loading"><span /><b>{busy || "Abriendo REVENUE…"}</b></div> :
      creating ? <CreatePlanModule busy={busy} onSubmit={createPlan} onCancel={() => { setCreating(false); setActive("inicio"); }} /> :
      active === "inicio" ? <HomeModule plans={dashboardPlans} onCreate={startCreate} onOpen={openDashboardPlan} onMonitor={(id) => openDashboardPlan(id, "monitoreo")} /> :
      active === "contexto" ? selected ? <ContextModule plan={selected} /> : <NoPlan onCreate={startCreate} /> :
      active === "informacion" ? selected ? <InformationModule files={state.files} accepted={state.accepted} systemReady={state.systemReady} busy={busy} onUpload={upload} onAccept={acceptInformation} onSynthetic={synthetic} /> : <NoPlan onCreate={startCreate} /> :
      active === "volumen-base" ? selected ? <BaselineModule baseline={state.baseline} review={state.review} ready={state.accepted} busy={busy} onCalculate={calculateBaseline} onApprove={approveBaseline} /> : <NoPlan onCreate={startCreate} /> :
      active === "plan-marketing" ? selected ? <GrowthPlanModule family="MARKETING" growth={state.growth} source={state.files.find((file) => file.requirementId === "marketing-plan")} synthetic={syntheticPlan} canBuild={growthCanBuild} waitingFor={growthWaitingFor} busy={busy} onUpload={upload} onBuild={buildGrowth} /> : <NoPlan onCreate={startCreate} /> :
      active === "plan-trade" ? selected ? <GrowthPlanModule family="TRADE_MARKETING" growth={state.growth} source={state.files.find((file) => file.requirementId === "trade-marketing-plan")} synthetic={syntheticPlan} canBuild={growthCanBuild} waitingFor={growthWaitingFor} busy={busy} onUpload={upload} onBuild={buildGrowth} /> : <NoPlan onCreate={startCreate} /> :
      active === "plan-anual" ? selected ? <ResultModule result={state.result} baselineUnits={state.review?.approvedAnnualUnits ?? state.baseline?.annualUnits ?? 0} growthUnits={state.growth?.netUnits ?? 0} ready={Boolean(state.growth?.controls.reconciled)} busy={busy} onBuild={buildResult} /> : <NoPlan onCreate={startCreate} /> :
      active === "rentabilidad" ? selected ? <ProfitabilityModule profitability={state.profitability} ready={Boolean(state.result?.controls.unitsReconciled && state.result.controls.valueReconciled)} busy={busy} onBuild={buildProfitability} /> : <NoPlan onCreate={startCreate} /> :
      active === "revision" ? selected ? <ReviewModule baseline={state.review} growth={state.growth} result={state.result} profitability={state.profitability} synthetic={syntheticPlan} busy={busy} onSubmit={submit} /> : <NoPlan onCreate={startCreate} /> :
      active === "monitoreo" ? selected ? <MonitoringModule planId={selected.id} /> : <NoPlan onCreate={startCreate} /> :
      <AdministrationModule />}
    </Shell>
  );
}

function NoPlan({ onCreate }: { onCreate: () => void }) {
  return <div className="module-page"><ModuleHead eyebrow="Información" title="Primero selecciona o crea un Plan" description="El contexto de compañía, cuenta, año y versión gobierna toda la información." /><EmptyAnswer title="No hay una cuenta activa" copy="Registra el contexto una sola vez y REVENUE lo conservará durante todo el recorrido." action={<button className="clay-primary" onClick={onCreate}>Crear un Plan</button>} /></div>;
}

function CreatePlanModule({ busy, onSubmit, onCancel }: { busy: string; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void; onCancel: () => void }) {
  return <div className="module-page"><ModuleHead eyebrow="Nuevo Plan" title="Registra el contexto una sola vez" description="Compañía, cuenta, año y moneda acompañarán cada cálculo, decisión y versión." /><form className="paper-panel create-paper-form" onSubmit={onSubmit}><label>Compañía<input name="company" required placeholder="Ej. Turmix de México" /></label><label>Cuenta<input name="account" required placeholder="Ej. Liverpool" /></label><label>Año del Plan<input name="year" required type="number" min="2026" defaultValue="2027" /></label><label>Moneda<select name="currency" defaultValue="MXN"><option>MXN</option><option>USD</option></select></label><div><button type="button" className="paper-button" onClick={onCancel}>Cancelar</button><button className="clay-primary" disabled={Boolean(busy)}>{busy || "Guardar y continuar"}</button></div></form></div>;
}

function AdministrationModule() {
  return <div className="module-page"><ModuleHead eyebrow="Administración" title="La estructura común para todas las aplicaciones" description="Compañías, cuentas, usuarios, permisos y reglas vivirán en una superficie compartida, compatible con la integración futura." /><section className="admin-foundation"><article><b>Compañías y cuentas</b><p>Contexto maestro reutilizable por Plan.</p></article><article><b>Usuarios y permisos</b><p>Acceso privado y responsabilidades por rol.</p></article><article><b>Reglas de gobierno</b><p>Aprobaciones, tolerancias, versiones y controles.</p></article></section></div>;
}
