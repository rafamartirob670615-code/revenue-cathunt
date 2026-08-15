import type { AlfaUniverseAccount } from "../domain/alfa-turmix-monitoring.ts";

type CanonicalAccountRow = {
  id_maestro: string;
  cuenta_cadena: string;
  grupo_corporativo: string | null;
  region: string | null;
  canal_consolidado: string | null;
  canal: string | null;
  subcanal: string | null;
};

function canonicalCredentials() {
  const url = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!url || !key) {
    throw new Error(
      "CANÓNICOS no está disponible: faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return { url: url.replace(/\/$/, ""), key };
}

export async function readCanonicalRevenueAccounts(): Promise<AlfaUniverseAccount[]> {
  const { url, key } = canonicalCredentials();
  const columns = [
    "id_maestro",
    "cuenta_cadena",
    "grupo_corporativo",
    "region",
    "canal_consolidado",
    "canal",
    "subcanal",
  ].join(",");
  const response = await fetch(
    `${url}/rest/v1/cuentas?select=${columns}&order=id_maestro.asc`,
    {
      cache: "no-store",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
      },
    },
  );
  if (!response.ok) {
    throw new Error(`CANÓNICOS respondió HTTP ${response.status} al leer cuentas.`);
  }
  const rows = (await response.json()) as CanonicalAccountRow[];
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("CANÓNICOS no devolvió un universo de cuentas utilizable.");
  }
  const ids = new Set<string>();
  return rows.map((row) => {
    if (!row.id_maestro || !row.cuenta_cadena || ids.has(row.id_maestro)) {
      throw new Error(`Cuenta canónica inválida o duplicada: ${row.id_maestro || "sin ID"}.`);
    }
    ids.add(row.id_maestro);
    return {
      id: row.id_maestro,
      name: row.cuenta_cadena,
      group: row.grupo_corporativo?.trim() || "(Individual)",
      territory: row.region?.trim() || "Nacional",
      channel: row.canal_consolidado?.trim() || row.canal?.trim() || "Sin clasificar",
      subchannel: row.subcanal?.trim() || "General",
    };
  });
}
