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

function parsePositiveInt(value: string, fieldName: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${fieldName}は1以上の整数で入力してください。`);
  }
  return parsed;
}

async function requireOwnerTenant() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    throw new Error("ログインが必要です。");
  }
  if (session.user.role !== "OWNER") {
    throw new Error("この操作はオーナーのみ実行できます。");
  }
  return { tenantId: session.user.tenantId, actorId: session.user.id };
}

export async function createMenu(formData: FormData) {
  const returnTo = getReturnTo(formData, "/menus");
  try {
    const { tenantId, actorId } = await requireOwnerTenant();

    const name = String(formData.get("name") ?? "").trim();
    const durationMinutes = parsePositiveInt(
      String(formData.get("durationMinutes") ?? "").trim(),
      "所要時間",
    );
    const priceRaw = String(formData.get("price") ?? "").trim();
    const price = priceRaw ? parsePositiveInt(priceRaw, "価格") : null;

    if (!name) {
      throw new Error("メニュー名は必須です。");
    }

    const menu = await prisma.serviceMenu.create({
      data: {
        tenantId,
        name,
        durationMinutes,
        price,
      },
    });
    await logAudit({
      tenantId,
      actorId,
      action: "menu.create",
      targetType: "ServiceMenu",
      targetId: menu.id,
      detail: `${menu.name} ${menu.durationMinutes}m`,
    });

    revalidatePath("/menus");
    revalidatePath("/appointments");
    redirectWithResult(returnTo, "success", "メニューを追加しました。");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirectWithResult(returnTo, "error", toErrorMessage(error));
  }
}

export async function updateMenu(formData: FormData) {
  const returnTo = getReturnTo(formData, "/menus");
  try {
    const { tenantId, actorId } = await requireOwnerTenant();

    const menuId = String(formData.get("menuId") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();
    const durationMinutes = parsePositiveInt(
      String(formData.get("durationMinutes") ?? "").trim(),
      "所要時間",
    );
    const priceRaw = String(formData.get("price") ?? "").trim();
    const price = priceRaw ? parsePositiveInt(priceRaw, "価格") : null;

    if (!menuId || !name) {
      throw new Error("メニューIDまたはメニュー名が不正です。");
    }

    await prisma.serviceMenu.updateMany({
      where: { id: menuId, tenantId },
      data: {
        name,
        durationMinutes,
        price,
      },
    });
    await logAudit({
      tenantId,
      actorId,
      action: "menu.update",
      targetType: "ServiceMenu",
      targetId: menuId,
      detail: `${name} ${durationMinutes}m`,
    });

    revalidatePath("/menus");
    revalidatePath("/appointments");
    redirectWithResult(returnTo, "success", "メニューを更新しました。");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirectWithResult(returnTo, "error", toErrorMessage(error));
  }
}

export async function deleteMenu(formData: FormData) {
  const returnTo = getReturnTo(formData, "/menus");
  try {
    const { tenantId, actorId } = await requireOwnerTenant();

    const menuId = String(formData.get("menuId") ?? "").trim();
    if (!menuId) {
      throw new Error("メニューIDが不正です。");
    }

    await prisma.$transaction([
      prisma.appointment.updateMany({
        where: { menuId, tenantId },
        data: { menuId: null },
      }),
      prisma.serviceMenu.deleteMany({
        where: { id: menuId, tenantId },
      }),
    ]);
    await logAudit({
      tenantId,
      actorId,
      action: "menu.delete",
      targetType: "ServiceMenu",
      targetId: menuId,
      detail: "deleted",
    });

    revalidatePath("/menus");
    revalidatePath("/appointments");
    redirectWithResult(returnTo, "success", "メニューを削除しました。");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirectWithResult(returnTo, "error", toErrorMessage(error));
  }
}
