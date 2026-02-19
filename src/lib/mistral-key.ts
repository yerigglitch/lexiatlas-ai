import { getUserApiKey } from "@/lib/api-keys";

export async function getUserMistralKey(userId: string) {
  return getUserApiKey(userId, "mistral");
}
