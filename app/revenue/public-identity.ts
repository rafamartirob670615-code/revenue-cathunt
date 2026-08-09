import type { RevenueIdentity } from "./access";

// The current REVENUE pilot uses synthetic, non-commercial data and is intentionally
// browser-agnostic. This identity is replaced by a real application login before
// exposing production data.
export const PUBLIC_REVENUE_IDENTITY: RevenueIdentity = {
  displayName: "Usuario piloto",
  email: "pilot@revenue.local",
  authenticated: true,
  functions: ["PLAN_OWNER"],
  capabilities: [],
};
