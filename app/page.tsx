import RevenuePlatform from "./revenue/RevenuePlatform";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { identityFromSession } from "./api/_access";
import { sessionActorFromCookie } from "./api/_session";

export const dynamic = "force-dynamic";

export default async function RevenueApp() {
  const requestHeaders = await headers();
  const session = sessionActorFromCookie(requestHeaders.get("cookie"));
  if (!session) {
    const origin = `https://${requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host")}`;
    redirect(`https://cathunt-hub.vercel.app/api/sso/token?url=${encodeURIComponent(origin)}`);
  }
  return <RevenuePlatform identity={identityFromSession(session)} />;
}
