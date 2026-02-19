import { notFound } from "next/navigation";
import { isFeatureEmailV2Enabled } from "@/lib/feature-flags";
import EmailTemplatesPageClient from "./client";

export default function EmailTemplatesPage() {
  if (!isFeatureEmailV2Enabled()) {
    notFound();
  }
  return <EmailTemplatesPageClient />;
}
