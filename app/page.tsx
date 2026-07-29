import RevenuePlatform from "./revenue/RevenuePlatform";
import { getChatGPTUser } from "./chatgpt-auth";
import { PILOT_CAPABILITIES } from "./revenue/access";

export const dynamic = "force-dynamic";

export default async function RevenueApp() {
  const user = await getChatGPTUser();
  const identity = {
    displayName: user?.displayName ?? "Usuario piloto",
    email: user?.email ?? "pilot@revenue.local",
    authenticated: Boolean(user),
    functions: ["PLAN_OWNER", "MARKETING", "TRADE_MARKETING", "FINANCE", "APPROVER", "ADMINISTRATOR"] as const,
    capabilities: PILOT_CAPABILITIES,
  };
  return <RevenuePlatform identity={identity} />;
}
