import RevenuePlatform from "../revenue/RevenuePlatform";
import { PUBLIC_REVENUE_IDENTITY } from "../revenue/public-identity";

export const dynamic = "force-dynamic";

export default async function MonitoringPage() {
  return <RevenuePlatform identity={PUBLIC_REVENUE_IDENTITY} initialModule="monitoreo" />;
}
