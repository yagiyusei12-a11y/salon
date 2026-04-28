import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { logAudit } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";

type BackupPayload = {
  exportedAt: string;
  tenantId: string;
  data: {
    customers: Array<{
      id: string;
      lastName: string;
      firstName: string;
      phone: string | null;
      email: string | null;
      notes: string | null;
      tags: string | null;
      lastVisitAt: string | null;
      createdAt: string;
      updatedAt: string;
    }>;
    serviceMenus: Array<{
      id: string;
      name: string;
      durationMinutes: number;
      price: number | null;
      createdAt: string;
      updatedAt: string;
    }>;
    appointments: Array<{
      id: string;
      staffId: string;
      customerId: string | null;
      menuId: string | null;
      startAt: string;
      endAt: string;
      status: "BOOKED" | "COMPLETED" | "CANCELLED";
      notes: string | null;
      createdAt: string;
      updatedAt: string;
    }>;
    payments: Array<{
      id: string;
      appointmentId: string | null;
      staffId: string | null;
      customerId: string | null;
      amount: number;
      method: "CASH" | "CARD" | "QR";
      paidAt: string;
      note: string | null;
      createdAt: string;
      updatedAt: string;
    }>;
  };
};

async function requireOwnerSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    throw new Error("Unauthorized");
  }
  if (session.user.role !== "OWNER") {
    throw new Error("Forbidden");
  }
  return session;
}

export async function GET() {
  try {
    const session = await requireOwnerSession();
    const tenantId = session.user.tenantId;

    const [customers, serviceMenus, appointments, payments] = await Promise.all([
      prisma.customer.findMany({ where: { tenantId }, orderBy: { createdAt: "asc" } }),
      prisma.serviceMenu.findMany({ where: { tenantId }, orderBy: { createdAt: "asc" } }),
      prisma.appointment.findMany({ where: { tenantId }, orderBy: { createdAt: "asc" } }),
      prisma.payment.findMany({ where: { tenantId }, orderBy: { createdAt: "asc" } }),
    ]);

    const payload: BackupPayload = {
      exportedAt: new Date().toISOString(),
      tenantId,
      data: {
        customers: customers.map((row: (typeof customers)[number]) => ({
          ...row,
          lastVisitAt: row.lastVisitAt?.toISOString() ?? null,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        })),
        serviceMenus: serviceMenus.map((row: (typeof serviceMenus)[number]) => ({
          ...row,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        })),
        appointments: appointments.map((row: (typeof appointments)[number]) => ({
          ...row,
          startAt: row.startAt.toISOString(),
          endAt: row.endAt.toISOString(),
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        })),
        payments: payments.map((row: (typeof payments)[number]) => ({
          ...row,
          paidAt: row.paidAt.toISOString(),
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        })),
      },
    };

    await logAudit({
      tenantId,
      actorId: session.user.id,
      action: "backup.export",
      targetType: "Backup",
      detail: "json",
    });

    return NextResponse.json(payload, {
      headers: {
        "Content-Disposition": 'attachment; filename="salon-backup.json"',
      },
    });
  } catch (error) {
    return new NextResponse(
      error instanceof Error ? error.message : "Backup export failed",
      { status: 403 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireOwnerSession();
    const tenantId = session.user.tenantId;

    const body = (await request.json()) as BackupPayload;
    if (!body?.data) {
      return new NextResponse("Invalid backup payload", { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.payment.deleteMany({ where: { tenantId } });
      await tx.appointment.deleteMany({ where: { tenantId } });
      await tx.serviceMenu.deleteMany({ where: { tenantId } });
      await tx.customer.deleteMany({ where: { tenantId } });

      if (body.data.customers.length > 0) {
        await tx.customer.createMany({
          data: body.data.customers.map((row) => ({
            id: row.id,
            tenantId,
            lastName: row.lastName,
            firstName: row.firstName,
            phone: row.phone,
            email: row.email,
            notes: row.notes,
            tags: row.tags,
            lastVisitAt: row.lastVisitAt ? new Date(row.lastVisitAt) : null,
            createdAt: new Date(row.createdAt),
            updatedAt: new Date(row.updatedAt),
          })),
        });
      }

      if (body.data.serviceMenus.length > 0) {
        await tx.serviceMenu.createMany({
          data: body.data.serviceMenus.map((row) => ({
            id: row.id,
            tenantId,
            name: row.name,
            durationMinutes: row.durationMinutes,
            price: row.price,
            createdAt: new Date(row.createdAt),
            updatedAt: new Date(row.updatedAt),
          })),
        });
      }

      if (body.data.appointments.length > 0) {
        await tx.appointment.createMany({
          data: body.data.appointments.map((row) => ({
            id: row.id,
            tenantId,
            staffId: row.staffId,
            customerId: row.customerId,
            menuId: row.menuId,
            startAt: new Date(row.startAt),
            endAt: new Date(row.endAt),
            status: row.status,
            notes: row.notes,
            createdAt: new Date(row.createdAt),
            updatedAt: new Date(row.updatedAt),
          })),
        });
      }

      if (body.data.payments.length > 0) {
        await tx.payment.createMany({
          data: body.data.payments.map((row) => ({
            id: row.id,
            tenantId,
            appointmentId: row.appointmentId,
            staffId: row.staffId,
            customerId: row.customerId,
            amount: row.amount,
            method: row.method,
            paidAt: new Date(row.paidAt),
            note: row.note,
            createdAt: new Date(row.createdAt),
            updatedAt: new Date(row.updatedAt),
          })),
        });
      }
    });

    await logAudit({
      tenantId,
      actorId: session.user.id,
      action: "backup.import",
      targetType: "Backup",
      detail: "json replace",
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return new NextResponse(
      error instanceof Error ? error.message : "Backup import failed",
      { status: 400 },
    );
  }
}
