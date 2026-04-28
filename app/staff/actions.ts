"use server";

import { hash } from "bcrypt";
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

async function requireOwnerSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    throw new Error("ログインが必要です。");
  }
  if (session.user.role !== "OWNER") {
    throw new Error("この操作はオーナーのみ実行できます。");
  }
  return session;
}

export async function createStaff(formData: FormData) {
  const returnTo = getReturnTo(formData, "/staff");
  try {
    const session = await requireOwnerSession();

    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "").trim();
    const role = String(formData.get("role") ?? "STAFF").trim();

    if (!name || !email || !password) {
      throw new Error("氏名・メールアドレス・パスワードは必須です。");
    }
    if (password.length < 8) {
      throw new Error("パスワードは8文字以上で入力してください。");
    }
    if (!["OWNER", "STAFF"].includes(role)) {
      throw new Error("ロールが不正です。");
    }

    const tenantId = session.user.tenantId;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.tenantId !== tenantId) {
      throw new Error("このメールアドレスは別テナントで使用されています。");
    }

    const passwordHash = await hash(password, 10);

    await prisma.user.upsert({
      where: { email },
      update: {
        name,
        role: role as "OWNER" | "STAFF",
        isActive: true,
        passwordHash,
        tenantId,
      },
      create: {
        name,
        email,
        role: role as "OWNER" | "STAFF",
        isActive: true,
        passwordHash,
        tenantId,
      },
    });
    await logAudit({
      tenantId,
      actorId: session.user.id,
      action: "staff.create_or_update",
      targetType: "User",
      targetId: email,
      detail: `${name} ${role}`,
    });

    revalidatePath("/staff");
    revalidatePath("/appointments");
    revalidatePath("/payments");
    redirectWithResult(returnTo, "success", "スタッフを保存しました。");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirectWithResult(returnTo, "error", toErrorMessage(error));
  }
}

export async function updateStaff(formData: FormData) {
  const returnTo = getReturnTo(formData, "/staff");
  try {
    const session = await requireOwnerSession();
    const tenantId = session.user.tenantId;

    const userId = String(formData.get("userId") ?? "").trim();
    const role = String(formData.get("role") ?? "STAFF").trim();
    const isActive = String(formData.get("isActive") ?? "true").trim() === "true";

    if (!userId) {
      throw new Error("ユーザーIDが不正です。");
    }
    if (!["OWNER", "STAFF"].includes(role)) {
      throw new Error("ロールが不正です。");
    }

    const target = await prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { id: true, role: true },
    });
    if (!target) {
      throw new Error("対象スタッフが見つかりません。");
    }

    if (session.user.id === userId && !isActive) {
      throw new Error("自分自身を無効化することはできません。");
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        role: role as "OWNER" | "STAFF",
        isActive,
      },
    });
    await logAudit({
      tenantId,
      actorId: session.user.id,
      action: "staff.update",
      targetType: "User",
      targetId: userId,
      detail: `role=${role},active=${isActive}`,
    });

    revalidatePath("/staff");
    revalidatePath("/appointments");
    revalidatePath("/payments");
    redirectWithResult(returnTo, "success", "スタッフ設定を更新しました。");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirectWithResult(returnTo, "error", toErrorMessage(error));
  }
}
