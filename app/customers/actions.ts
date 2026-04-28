"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { logAudit } from "@/lib/audit-log";
import {
  getReturnTo,
  redirectWithResult,
  rethrowIfRedirectError,
  toErrorMessage,
} from "@/lib/action-result";
import { prisma } from "@/lib/prisma";

const ALLOWED_TAGS = new Set(["VIP", "CAUTION", "NEW"]);

function normalizeTags(raw: string) {
  const unique = Array.from(
    new Set(
      raw
        .split(",")
        .map((item) => item.trim().toUpperCase())
        .filter((item) => ALLOWED_TAGS.has(item)),
    ),
  );
  return unique.join(",");
}

export async function createCustomer(formData: FormData) {
  const returnTo = getReturnTo(formData, "/customers");
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.tenantId) {
      throw new Error("ログインが必要です。");
    }

    const lastName = String(formData.get("lastName") ?? "").trim();
    const firstName = String(formData.get("firstName") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();
    const tags = normalizeTags(String(formData.get("tags") ?? ""));

    if (!lastName || !firstName) {
      throw new Error("姓と名は必須です。");
    }

    const customer = await prisma.customer.create({
      data: {
        tenantId: session.user.tenantId,
        lastName,
        firstName,
        phone: phone || null,
        email: email || null,
        notes: notes || null,
        tags: tags || null,
      },
    });
    await logAudit({
      tenantId: session.user.tenantId,
      actorId: session.user.id,
      action: "customer.create",
      targetType: "Customer",
      targetId: customer.id,
      detail: `${customer.lastName} ${customer.firstName}`,
    });

    revalidatePath("/customers");
    redirectWithResult(returnTo, "success", "顧客を登録しました。");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirectWithResult(returnTo, "error", toErrorMessage(error));
  }
}

export async function updateCustomerTags(formData: FormData) {
  const returnTo = getReturnTo(formData, "/customers");
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      throw new Error("ログインが必要です。");
    }

    const customerId = String(formData.get("customerId") ?? "").trim();
    const tags = normalizeTags(String(formData.get("tags") ?? ""));

    if (!customerId) {
      throw new Error("顧客IDが不正です。");
    }

    await prisma.customer.updateMany({
      where: { id: customerId, tenantId: session.user.tenantId },
      data: { tags: tags || null },
    });

    await logAudit({
      tenantId: session.user.tenantId,
      actorId: session.user.id,
      action: "customer.tags.update",
      targetType: "Customer",
      targetId: customerId,
      detail: tags || "none",
    });

    revalidatePath("/customers");
    revalidatePath(`/customers/${customerId}`);
    redirectWithResult(returnTo, "success", "タグを保存しました。");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirectWithResult(returnTo, "error", toErrorMessage(error));
  }
}
