"use client";

import { useEffect, useMemo, useState } from "react";
import type { Plan, PlanStatus } from "../domain/types";

type DashboardStage =
  | "PREPARE_INFORMATION"
  | "COMPLETE_INFORMATION"
  | "REVIEW_PACKAGE"
  | "BUILD_BASELINE"
  | "BUILD_PLAN"
  | "REVIEW_APPROVAL"
  | "OFFICIAL";

interface DashboardPlan {
  id: string;
  company: string;
  account: string;
  year: number;
  currency: string;
  version: number;
  status: PlanStatus;
  stage: DashboardStage;
  nextAction: string;
  readyFiles: number;
  packageAccepted: boolean;
  updatedAt: string;
}

interface DashboardData {
  owner: { email: string; name?: string };
  plans: DashboardPlan[];
}

const syntheticName = "PILOTO SINTÉTICO NO COMERCIAL";

export default function RevenueLobby({
  openPlan,
  createPlan,
  openSynthetic,
}: {
  openPlan: (planId: string) => void;
  createPlan: () => void;
  openSynthetic: (planId: string) => void;
}) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [preparingPilot, setPreparingPilot] = useState(false);

  async function loadLobby() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/dashboard", { cache: "no-store" });
      const body = (await response.json()) as DashboardData & { ok?: boolean; error?: string };
      if (!response.ok || body.ok === false) throw new Error(body.error);
      setData(body);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos abrir tus Planes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // La carga inicial se ejecuta una sola vez después del montaje.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadLobby();
  }, []);

  const plans = useMemo(() => data?.plans ?? [], [data]);
  const syntheticPlan = plans.find((plan) => plan.account === syntheticName);
  const realPlans = plans.filter((plan) => plan.account !== syntheticName);
  const recentPlans = realPlans.slice(0, 3);
  const ownerFirstName = data?.owner.name?.split(/\s+/)[0] ?? "Roberto";

  async function ensureSyntheticPlan(planId: string) {
    const inputResponse = await fetch(`/api/inputs?planId=${encodeURIComponent(planId)}`, { cache: "no-store" });
    const inputState = (await inputResponse.json()) as {
      ok: boolean;
      files?: Array<{ synthetic?: boolean }>;
      systemReady?: boolean;
      accepted?: boolean;
      error?: string;
    };
    if (!inputResponse.ok || !inputState.ok) throw new Error(inputState.error);
    const syntheticPackageReady =
      inputState.accepted === true &&
      inputState.systemReady === true &&
      Boolean(inputState.files?.length) &&
      inputState.files?.every((file) => file.synthetic === true);

    if (!syntheticPackageReady) {
      const packageResponse = await fetch("/api/inputs", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const packageBody = (await packageResponse.json()) as { ok: boolean; error?: string };
      if (!packageResponse.ok || !packageBody.ok) throw new Error(packageBody.error);
      const acceptResponse = await fetch("/api/inputs", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const accepted = (await acceptResponse.json()) as { ok: boolean; error?: string };
      if (!acceptResponse.ok || !accepted.ok) throw new Error(accepted.error);
    }

    let baselineResponse = await fetch(`/api/baseline?planId=${encodeURIComponent(planId)}`, { cache: "no-store" });
    let baselineState = (await baselineResponse.json()) as { ok: boolean; result?: unknown; review?: { status?: string }; error?: string };
    if (!baselineState.result) {
      baselineResponse = await fetch("/api/baseline", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      baselineState = (await baselineResponse.json()) as typeof baselineState;
      if (!baselineResponse.ok || !baselineState.ok) throw new Error(baselineState.error);
    }
    if (baselineState.review?.status !== "APPROVED_FROZEN") {
      const reviewResponse = await fetch("/api/baseline", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId, decision: "CALCULATED" }),
      });
      const review = (await reviewResponse.json()) as { ok: boolean; error?: string };
      if (!reviewResponse.ok || !review.ok) throw new Error(review.error);
    }

    const growthGet = await fetch(`/api/growth?planId=${encodeURIComponent(planId)}`, { cache: "no-store" });
    const growthState = (await growthGet.json()) as { ok: boolean; result?: unknown; error?: string };
    if (!growthState.result) {
      const growthResponse = await fetch("/api/growth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const growth = (await growthResponse.json()) as { ok: boolean; error?: string };
      if (!growthResponse.ok || !growth.ok) throw new Error(growth.error);
    }

    const resultGet = await fetch(`/api/result?planId=${encodeURIComponent(planId)}`, { cache: "no-store" });
    const resultState = (await resultGet.json()) as { ok: boolean; result?: unknown; error?: string };
    if (!resultState.result) {
      const resultResponse = await fetch("/api/result", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const result = (await resultResponse.json()) as { ok: boolean; error?: string };
      if (!resultResponse.ok || !result.ok) throw new Error(result.error);
    }

    const profitGet = await fetch(`/api/profitability?planId=${encodeURIComponent(planId)}`, { cache: "no-store" });
    const profitState = (await profitGet.json()) as { ok: boolean; result?: unknown; error?: string };
    if (!profitState.result) {
      const profitResponse = await fetch("/api/profitability", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const profit = (await profitResponse.json()) as { ok: boolean; error?: string };
      if (!profitResponse.ok || !profit.ok) throw new Error(profit.error);
    }
  }

  async function createSyntheticPilot() {
    setPreparingPilot(true);
    setError("");
    try {
      if (syntheticPlan) {
        await ensureSyntheticPlan(syntheticPlan.id);
        openSynthetic(syntheticPlan.id);
        return;
      }
      const occurredAt = new Date().toISOString();
      const planId = `plan:${crypto.randomUUID()}`;
      const versionId = `version:${crypto.randomUUID()}`;
      const plan: Plan = {
        id: planId,
        organizationId: "revenue-pilot",
        companyId: "revenue-lab",
        companyName: "REVENUE LAB",
        accountId: "piloto-sintetico-no-comercial",
        accountName: syntheticName,
        year: new Date().getFullYear() + 1,
        currency: "MXN",
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
      const createResponse = await fetch("/api/plans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "create",
          plan,
          context: { commandId: `create:${crypto.randomUUID()}`, actorId: "authenticated-user", occurredAt },
        }),
      });
      const created = (await createResponse.json()) as { ok: boolean; result?: Plan; error?: string };
      if (!createResponse.ok || !created.ok || !created.result) throw new Error(created.error);
      await ensureSyntheticPlan(planId);
      openSynthetic(planId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos preparar el piloto.");
    } finally {
      setPreparingPilot(false);
    }
  }

  if (loading) {
    return <div className="recovery-loading"><span /><b>Abriendo tu espacio de planeación…</b></div>;
  }

  return (
    <div className="revenue-lobby">
      <section className="lobby-intro">
        <p className="eyebrow">Tu espacio de planeación</p>
        <h1>Hola, {ownerFirstName}. ¿Qué quieres hacer?</h1>
        <p>Elige un camino. REVENUE te llevará directamente al Plan, sin mezclar construcción con Monitoreo.</p>
      </section>

      {error && <div className="recoverable-error" role="alert">{error}</div>}

      <section className="lobby-actions" aria-label="Opciones para comenzar">
        <article className="lobby-card continue-card">
          <span className="lobby-step">01</span>
          <div>
            <small>Retomar trabajo</small>
            <h2>Continuar un Plan</h2>
            <p>Abre un Plan guardado y sigue exactamente desde su resultado vigente.</p>
          </div>
          {recentPlans.length ? (
            <div className="lobby-plan-list">
              {recentPlans.map((plan) => (
                <button key={plan.id} onClick={() => openPlan(plan.id)}>
                  <div><b>{plan.account}</b><small>{plan.company} · {plan.year} · V{plan.version}</small></div>
                  <span>{plan.nextAction}</span><strong>→</strong>
                </button>
              ))}
            </div>
          ) : (
            <div className="lobby-empty">Todavía no tienes Planes comerciales guardados.</div>
          )}
        </article>

        <article className="lobby-card real-card">
          <span className="lobby-step">02</span>
          <div>
            <small>Construcción comercial</small>
            <h2>Crear un Plan real</h2>
            <p>Define cuenta y año; después incorpora únicamente información comercial autorizada.</p>
          </div>
          <button className="lobby-primary" onClick={createPlan}>Crear Plan real <strong>→</strong></button>
        </article>

        <article className="lobby-card pilot-card">
          <span className="lobby-step">03</span>
          <div>
            <small>Recorrido guiado</small>
            <h2>Explorar el Plan piloto</h2>
            <p>Abre un Plan completo de prueba con datos claramente separados de cualquier resultado comercial.</p>
          </div>
          <div className="pilot-label">DATOS SINTÉTICOS — NO COMERCIALES</div>
          <button className="lobby-primary pilot" onClick={() => void createSyntheticPilot()} disabled={preparingPilot}>
            {preparingPilot ? "Preparando piloto…" : syntheticPlan ? "Abrir Plan piloto" : "Crear y abrir Plan piloto"} <strong>→</strong>
          </button>
        </article>
      </section>

      <footer className="lobby-footer">
        <span><i /> Guardado privado</span>
        <p>Monitoreo aparecerá cuando exista un Plan comercial oficial y resultados reales comparables.</p>
      </footer>
    </div>
  );
}
