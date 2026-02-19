import { notFound } from "next/navigation";
import { isFeatureEmailV2Enabled } from "@/lib/feature-flags";
import EmailPageClient from "./client";

export default function EmailPage() {
  if (!isFeatureEmailV2Enabled()) {
    notFound();
  }
  return <EmailPageClient />;
}
