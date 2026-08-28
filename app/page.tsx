import RevenuePlatform from "./revenue/RevenuePlatform";
import { headers } from "next/headers";
import { identityFromSession } from "./api/_access";
import { requireSession } from "./api/_session";

export const dynamic = "force-dynamic";

export default async function RevenueApp() {
  const session = requireSession(await headers());
  return <RevenuePlatform identity={identityFromSession(session)} />;
}
