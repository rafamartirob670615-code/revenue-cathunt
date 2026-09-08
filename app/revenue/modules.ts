export type RevenueModule =
  | "contexto"
  | "informacion"
  | "volumen-base"
  | "plan-marketing"
  | "plan-trade"
  | "plan-anual"
  | "rentabilidad"
  | "revision"
  | "monitoreo"
  | "administracion";

export type RevenueModuleDefinition = {
  slug: RevenueModule;
  name: string;
  question: string;
  group: "general" | "build" | "execute" | "system";
  step?: number;
};

export const REVENUE_MODULES: RevenueModuleDefinition[] = [
  { slug: "contexto", name: "Crear plan", question: "Compañía, cuenta, año y versión", group: "build", step: 1 },
  { slug: "informacion", name: "Información", question: "Excel y fuentes empresariales", group: "build", step: 2 },
  { slug: "volumen-base", name: "Volumen base", question: "Venta sin nuevas actividades", group: "build", step: 3 },
  { slug: "plan-marketing", name: "Plan de Marketing", question: "Demanda y construcción de marca", group: "build", step: 4 },
  { slug: "plan-trade", name: "Plan de Trade Marketing", question: "Ejecución en el cliente", group: "build", step: 5 },
  { slug: "plan-anual", name: "Plan anual", question: "Unidades y valor consolidados", group: "build", step: 6 },
  { slug: "rentabilidad", name: "Rentabilidad", question: "Margen, inversión y contribución", group: "build", step: 7 },
  { slug: "revision", name: "Revisión y aprobación", question: "Controles y aprobación final", group: "build", step: 8 },
  { slug: "monitoreo", name: "Seguimiento", question: "Cómo va el plan al día de hoy", group: "execute" },
  { slug: "administracion", name: "Administración", question: "Usuarios, permisos y reglas", group: "system" },
];
