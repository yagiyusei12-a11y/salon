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
    throw new Error("開始日時の形式が不正です。");
  }
  return date;
}

async function ensureSameTenantEntity({
  tenantId,
  staffId,
  customerId,
  menuId,
}: {
  tenantId: string;
  staffId: string;
  customerId: string;
  menuId: string;
}) {
  const staff = await prisma.user.findFirst({
    where: { id: staffId, tenantId },
    select: { id: true },
  });
  if (!staff) {
    throw new Error("選択したスタッフが見つかりません。");
  }

  if (customerId) {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, tenantId },
      select: { id: true },
    });
    if (!customer) {
      throw new Error("選択した顧客が見つかりません。");
    }
  }

  if (menuId) {
    const menu = await prisma.serviceMenu.findFirst({
      where: { id: menuId, tenantId },
      select: { id: true },
    });
    if (!menu) {
      throw new Error("選択したメニューが見つかりません。");
    }
  }
}

async function ensureNoOverlap({
  tenantId,
  staffId,
  startAt,
  endAt,
  excludeAppointmentId,
}: {
  tenantId: string;
  staffId: string;
  startAt: Date;
  endAt: Date;
  excludeAppointmentId?: string;
}) {
  const overlapping = await prisma.appointment.findFirst({
    where: {
      tenantId,
      staffId,
      status: "BOOKED",
      id: excludeAppointmentId ? { not: excludeAppointmentId } : undefined,
      startAt: { lt: endAt },
      endAt: { gt: startAt },
    },
    select: { id: true },
  });

  if (overlapping) {
    throw new Error("このスタッフの予約時間が重複しています。");
  }
}

function readAppointmentInput(formData: FormData) {
  const staffId = String(formData.get("staffId") ?? "").trim();
  const customerId = String(formData.get("customerId") ?? "").trim();
  const menuId = String(formData.get("menuId") ?? "").trim();
  const startAtRaw = String(formData.get("startAt") ?? "").trim();
  const durationMinutesRaw = String(formData.get("durationMinutes") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!staffId || !startAtRaw || !durationMinutesRaw) {
    throw new Error("スタッフ・開始時刻・所要時間は必須です。");
  }

  const durationMinutes = Number(durationMinutesRaw);
  if (!Number.isInteger(durationMinutes) || durationMinutes < 5 || durationMinutes > 600) {
    throw new Error("所要時間は5〜600分の整数で入力してください。");
  }

  const startAt = parseDateTimeLocal(startAtRaw);
  const endAt = new Date(startAt.getTime() + durationMinutes * 60 * 1000);

  return { staffId, customerId, menuId, notes, startAt, endAt };
}

export async function createAppointment(formData: FormData) {
  const returnTo = getReturnTo(formData, "/appointments");
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.tenantId) {
      throw new Error("ログインが必要です。");
    }

    const tenantId = session.user.tenantId;
    const { staffId, customerId, menuId, notes, startAt, endAt } =
      readAppointmentInput(formData);

    await ensureSameTenantEntity({
      tenantId,
      staffId,
      customerId,
      menuId,
    });
    await ensureNoOverlap({ tenantId, staffId, startAt, endAt });

    const appointment = await prisma.appointment.create({
      data: {
        tenantId,
        staffId,
        customerId: customerId || null,
        menuId: menuId || null,
        startAt,
        endAt,
        notes: notes || null,
      },
    });
    await logAudit({
      tenantId,
      actorId: session.user.id,
      action: "appointment.create",
      targetType: "Appointment",
      targetId: appointment.id,
      detail: `${appointment.startAt.toISOString()}-${appointment.endAt.toISOString()}`,
    });

    revalidatePath("/appointments");
    redirectWithResult(returnTo, "success", "予約を登録しました。");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirectWithResult(returnTo, "error", toErrorMessage(error));
  }
}

export async function updateAppointment(formData: FormData) {
  const returnTo = getReturnTo(formData, "/appointments");
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      throw new Error("ログインが必要です。");
    }

    const tenantId = session.user.tenantId;
    const appointmentId = String(formData.get("appointmentId") ?? "").trim();
    if (!appointmentId) {
      throw new Error("予約IDが不正です。");
    }

    const existingAppointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, tenantId, status: "BOOKED" },
      select: { id: true },
    });
    if (!existingAppointment) {
      throw new Error("対象の予約が見つからないか、編集できない状態です。");
    }

    const { staffId, customerId, menuId, notes, startAt, endAt } =
      readAppointmentInput(formData);

    await ensureSameTenantEntity({
      tenantId,
      staffId,
      customerId,
      menuId,
    });
    await ensureNoOverlap({
      tenantId,
      staffId,
      startAt,
      endAt,
      excludeAppointmentId: appointmentId,
    });

    await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        staffId,
        customerId: customerId || null,
        menuId: menuId || null,
        startAt,
        endAt,
        notes: notes || null,
      },
    });
    await logAudit({
      tenantId,
      actorId: session.user.id,
      action: "appointment.update",
      targetType: "Appointment",
      targetId: appointmentId,
      detail: `${startAt.toISOString()}-${endAt.toISOString()}`,
    });

    revalidatePath("/appointments");
    revalidatePath(`/appointments/${appointmentId}/edit`);
    redirectWithResult(returnTo, "success", "予約を更新しました。");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirectWithResult(returnTo, "error", toErrorMessage(error));
  }
}

export async function cancelAppointment(formData: FormData) {
  const returnTo = getReturnTo(formData, "/appointments");
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      throw new Error("ログインが必要です。");
    }

    const tenantId = session.user.tenantId;
    const appointmentId = String(formData.get("appointmentId") ?? "").trim();
    if (!appointmentId) {
      throw new Error("予約IDが不正です。");
    }

    await prisma.appointment.updateMany({
      where: { id: appointmentId, tenantId, status: "BOOKED" },
      data: { status: "CANCELLED" },
    });
    await logAudit({
      tenantId,
      actorId: session.user.id,
      action: "appointment.cancel",
      targetType: "Appointment",
      targetId: appointmentId,
      detail: "status=CANCELLED",
    });

    revalidatePath("/appointments");
    redirectWithResult(returnTo, "success", "予約をキャンセルしました。");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirectWithResult(returnTo, "error", toErrorMessage(error));
  }
}

export async function completeAppointment(formData: FormData) {
  const returnTo = getReturnTo(formData, "/appointments");
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      throw new Error("ログインが必要です。");
    }

    const tenantId = session.user.tenantId;
    const appointmentId = String(formData.get("appointmentId") ?? "").trim();
    if (!appointmentId) {
      throw new Error("予約IDが不正です。");
    }

    await prisma.appointment.updateMany({
      where: { id: appointmentId, tenantId, status: "BOOKED" },
      data: { status: "COMPLETED" },
    });
    await logAudit({
      tenantId,
      actorId: session.user.id,
      action: "appointment.complete",
      targetType: "Appointment",
      targetId: appointmentId,
      detail: "status=COMPLETED",
    });

    revalidatePath("/appointments");
    revalidatePath("/payments");
    revalidatePath("/");
    redirectWithResult(returnTo, "success", "来店完了に更新しました。");
  } catch (error) {
    rethrowIfRedirectError(error);
    redirectWithResult(returnTo, "error", toErrorMessage(error));
  }
}
