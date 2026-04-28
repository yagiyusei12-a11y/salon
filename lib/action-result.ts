import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";

export function getReturnTo(formData: FormData, fallbackPath: string) {
  const raw = String(formData.get("returnTo") ?? "").trim();
  if (!raw) return fallbackPath;
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallbackPath;
  return raw;
}

export function redirectWithResult(
  returnTo: string,
  status: "success" | "error",
  message: string,
) {
  const separator = returnTo.includes("?") ? "&" : "?";
  const safeMessage = encodeURIComponent(message);
  redirect(`${returnTo}${separator}result=${status}&message=${safeMessage}`);
}

export function rethrowIfRedirectError(error: unknown) {
  if (isRedirectError(error)) {
    throw error;
  }
}

export function toErrorMessage(error: unknown, fallback = "処理に失敗しました。") {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}
