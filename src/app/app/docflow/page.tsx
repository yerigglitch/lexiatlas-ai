import { notFound } from "next/navigation";
import { isFeatureDocflowEnabled } from "@/lib/feature-flags";
import DocFlowClientPage from "./client";

export default function DocFlowPage() {
  if (!isFeatureDocflowEnabled()) {
    notFound();
  }
  return <DocFlowClientPage />;
}
