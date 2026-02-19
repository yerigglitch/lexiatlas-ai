import { notFound } from "next/navigation";
import { isFeatureEmailV2Enabled } from "@/lib/feature-flags";
import EmailLogsPageClient from "./client";

export default function EmailLogsPage() {
  if (!isFeatureEmailV2Enabled()) {
    notFound();
  }
  return <EmailLogsPageClient />;
}
