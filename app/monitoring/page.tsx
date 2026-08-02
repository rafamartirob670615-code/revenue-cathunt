import RevenuePlatform from "../revenue/RevenuePlatform";
import { getChatGPTUser } from "../chatgpt-auth";
import type { RevenueIdentity } from "../revenue/access";

export const dynamic = "force-dynamic";

export default async function MonitoringPage() {
  const user = await getChatGPTUser();
  const identity: RevenueIdentity = {
    displayName: user?.displayName ?? "Usuario piloto",
    email: user?.email ?? "pilot@revenue.local",
    authenticated: Boolean(user),
    functions: ["PLAN_OWNER"],
    capabilities: [],
  };
  return <RevenuePlatform identity={identity} initialModule="monitoreo" />;
}
