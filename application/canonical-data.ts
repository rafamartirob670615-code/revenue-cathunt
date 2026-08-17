import type { AlfaUniverseAccount } from "../domain/alfa-turmix-monitoring.ts";
import postgres from "postgres";

type CanonicalAccountRow = {
  id_maestro: string;
  cuenta_cadena: string;
  grupo_corporativo: string | null;
  region: string | null;
  canal_consolidado: string | null;
  canal: string | null;
  subcanal: string | null;
};

const globalCanonicalDatabase = globalThis as typeof globalThis & {
  canonicalRevenuePostgres?: ReturnType<typeof postgres>;
};

function canonicalDatabase() {
  const connectionString = (process.env.SUPABASE_DATABASE_URL ?? process.env.DATABASE_URL ?? "").trim();
  if (!connectionString) {
    throw new Error("CANÓNICOS no está disponible: falta SUPABASE_DATABASE_URL.");
  }
  globalCanonicalDatabase.canonicalRevenuePostgres ??= postgres(connectionString, {
    max: 2,
    prepare: false,
    connect_timeout: 10,
    idle_timeout: 20,
  });
  return globalCanonicalDatabase.canonicalRevenuePostgres;
}

export async function readCanonicalRevenueAccounts(): Promise<AlfaUniverseAccount[]> {
  const rows = await canonicalDatabase()<CanonicalAccountRow[]>`
    SELECT id_maestro, cuenta_cadena, grupo_corporativo, region,
           canal_consolidado, canal, subcanal
    FROM public.cuentas
    ORDER BY id_maestro ASC
  `;
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
