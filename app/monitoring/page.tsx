import RevenuePlatform from "../revenue/RevenuePlatform";
import { headers } from "next/headers";
import { identityFromSession } from "../api/_access";
import { requireSession } from "../api/_session";

export const dynamic = "force-dynamic";

export default async function MonitoringPage() {
  const session = requireSession(await headers(), "/monitoring");
  return <RevenuePlatform identity={identityFromSession(session)} initialModule="monitoreo" />;
}
