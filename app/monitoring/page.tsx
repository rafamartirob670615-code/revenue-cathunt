import RevenuePlatform from "../revenue/RevenuePlatform";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { identityFromSession } from "../api/_access";
import { sessionActorFromCookie } from "../api/_session";

export const dynamic = "force-dynamic";

export default async function MonitoringPage() {
  const requestHeaders = await headers();
  const session = sessionActorFromCookie(requestHeaders.get("cookie"));
  if (!session) redirect("https://cathunt-hub.vercel.app/api/sso/token?url=https%3A%2F%2Frevenue-marsal1.vercel.app%2Fmonitoring");
  return <RevenuePlatform identity={identityFromSession(session)} initialModule="monitoreo" />;
}
