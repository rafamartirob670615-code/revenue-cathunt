import RevenuePlatform from "./revenue/RevenuePlatform";
import { PUBLIC_REVENUE_IDENTITY } from "./revenue/public-identity";

export const dynamic = "force-dynamic";

export default async function RevenueApp() {
  return <RevenuePlatform identity={PUBLIC_REVENUE_IDENTITY} />;
}
