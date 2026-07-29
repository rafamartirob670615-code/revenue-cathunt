export type RevenueModule =
  | "inicio"
  | "informacion"
  | "volumen-base"
  | "crecimiento"
  | "plan-anual"
  | "rentabilidad"
  | "revision"
  | "monitoreo"
  | "administracion";

export const REVENUE_MODULES: Array<{
  slug: RevenueModule;
  name: string;
  question: string;
}> = [
  { slug: "inicio", name: "Inicio", question: "¿Qué necesito hacer hoy?" },
  { slug: "informacion", name: "Información", question: "¿Qué información tengo y cómo la entendió REVENUE?" },
  { slug: "volumen-base", name: "Volumen base", question: "¿Qué vendería la cuenta sin nuevas actividades?" },
  { slug: "crecimiento", name: "Crecimiento", question: "¿Qué aportarán Marketing y Trade Marketing?" },
  { slug: "plan-anual", name: "Plan anual", question: "¿Cuánto venderemos en unidades y valor?" },
  { slug: "rentabilidad", name: "Rentabilidad", question: "¿Cuánto dinero dejará el Plan?" },
  { slug: "revision", name: "Revisión", question: "¿Qué falta validar o aprobar?" },
  { slug: "monitoreo", name: "Monitoreo", question: "¿Cómo vamos contra Plan, cuota y año anterior?" },
  { slug: "administracion", name: "Administración", question: "Compañías, cuentas, usuarios, permisos y reglas" },
];
