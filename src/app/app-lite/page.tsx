import { notFound } from "next/navigation";
import { isFeatureAppLiteEnabled } from "@/lib/feature-flags";
import AppLiteClientPage from "./client";

export default function AppLitePage() {
  if (!isFeatureAppLiteEnabled()) {
    notFound();
  }
  return <AppLiteClientPage />;
}
