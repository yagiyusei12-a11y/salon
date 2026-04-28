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

function parseDateTimeLocal(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("会計日時の形式が不正です。");
  }
  return date;
}

function parsePositiveInt(value: string, fieldName: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${fieldName}は1以上の整数で入力してください。`);
  }
  return parsed;
}

export async function createPayment(formData: FormData) {
  const returnTo = getReturnTo(formData, "/payments");
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      throw new Error("ログインが必要です。");
    }

    const tenantId = session.user.tenantId;
    const amount = parsePositiveInt(String(formData.get("amount") ?? "").trim(), "金額");
    const method = String(formData.get("method") ?? "CASH").trim();
    const paidAt = parseDateTimeLocal(String(formData.get("paidAt") ?? "").trim());
    const appointmentId = String(formData.get("appointmentId") ?? "").trim();
    const staffId = String(formData.get("staffId") ?? "").trim();
    const customerId = String(formData.get("customerId") ?? "").trim();
    const note = String(formData.get("note") ?? "").trim();

    if (!["CASH", "CARD", "QR"].includes(method)) {
      throw new Error("支払い方法が不正です。");
    }

    if (appointmentId) {
      const appointment = await prisma.appointment.findFirst({
        where: { id: appointmentId, tenantId },
        select: { id: true, status: true, payment: { select: { id: true } } },
      });
      if (!appointment) {
        throw new Error("対象予約が見つかりません。");
      }
      if (appointment.payment) {
        throw new Error("この予約はすでに会計済みです。");
      }
      if (appointment.status !== "COMPLETED") {
        throw new Error("会計登録は来店完了の予約に対してのみ可能です。");
      }
    }

    if (staffId) {
      const staff = await prisma.user.findFirst({
        where: { id: staffId, tenantId },
        select: { id: true },
      });
      if (!staff) {
        throw new Error("担当スタッフが見つかりません。");
      }
    }

    if (customerId) {
      const customer = await prisma.customer.findFirst({
        where: { id: customerId, tenantId },
        select: { id: true },
      });
      if (!customer) {
        throw new Error("顧客が見つかりません。");
      }
    }

    const payment = await prisma.payment.create({
      data: {
        tenantId,
        amount,
        method: method as "CASH" | "CARD" | "QR",
        paidAt,
        appointmentId: appointmentId || null,
        staffId: staffId || null,
        customerId: customerId || null,
        note: note || null,
      },
    });
    await logAudit({
      tenantId,
      actorId: session.user.id,
      action: "payment.create",
      targetType: "Payment",
      targetId: payment.id,
      detail: `${payment.amount} ${payment.method}`,
    });

    revalidatePath("/payments");
    revalidatePath("/appointments");
    redirectWithResult(returnTo, "success", "会計を登録しました。");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirectWithResult(returnTo, "error", toErrorMessage(error));
  }
}
