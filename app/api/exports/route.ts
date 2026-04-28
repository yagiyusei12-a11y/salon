import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function toCsv(headers: string[], rows: Array<Array<unknown>>) {
  const headerLine = headers.map(csvEscape).join(",");
  const rowLines = rows.map((row) => row.map(csvEscape).join(","));
  return [headerLine, ...rowLines].join("\n");
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const tenantId = session.user.tenantId;
  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("kind");
  const q = (searchParams.get("q") ?? "").trim();
  const tag = (searchParams.get("tag") ?? "").trim().toUpperCase();
  const staffId = (searchParams.get("staffId") ?? "").trim();
  const status = (searchParams.get("status") ?? "").trim();
  const method = (searchParams.get("method") ?? "").trim();
  const fromRaw = (searchParams.get("from") ?? "").trim();
  const toRaw = (searchParams.get("to") ?? "").trim();
  const sort = (searchParams.get("sort") ?? "").trim();

  const from = fromRaw ? new Date(fromRaw) : null;
  const to = toRaw ? new Date(toRaw) : null;
  const fromValid = from && !Number.isNaN(from.getTime()) ? from : null;
  const toValid = to && !Number.isNaN(to.getTime()) ? to : null;
  const toEndExclusive = toValid ? new Date(toValid.getTime() + 24 * 60 * 60 * 1000) : null;

  if (kind === "customers") {
    const where = {
      tenantId,
      ...(tag && ["VIP", "CAUTION", "NEW"].includes(tag) ? { tags: { contains: tag } } : {}),
      ...(q
        ? {
            OR: [
              { lastName: { contains: q } },
              { firstName: { contains: q } },
              { email: { contains: q } },
              { phone: { contains: q } },
              { notes: { contains: q } },
            ],
          }
        : {}),
    };

    const customers = await prisma.customer.findMany({
      where,
      orderBy:
        sort === "created_asc"
          ? { createdAt: "asc" }
          : sort === "name_asc"
            ? [{ lastName: "asc" }, { firstName: "asc" }]
            : { createdAt: "desc" },
      take: 5000,
    });

    const csv = toCsv(
      [
        "id",
        "lastName",
        "firstName",
        "phone",
        "email",
        "tags",
        "notes",
        "createdAt",
      ],
      customers.map((customer: (typeof customers)[number]) => [
        customer.id,
        customer.lastName,
        customer.firstName,
        customer.phone ?? "",
        customer.email ?? "",
        customer.tags ?? "",
        customer.notes ?? "",
        customer.createdAt.toISOString(),
      ]),
    );

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="customers.csv"',
      },
    });
  }

  if (kind === "appointments") {
    const where = {
      tenantId,
      ...(staffId ? { staffId } : {}),
      ...(status && ["BOOKED", "COMPLETED", "CANCELLED"].includes(status)
        ? { status: status as "BOOKED" | "COMPLETED" | "CANCELLED" }
        : {}),
      ...(fromValid || toEndExclusive
        ? {
            startAt: {
              ...(fromValid ? { gte: fromValid } : {}),
              ...(toEndExclusive ? { lt: toEndExclusive } : {}),
            },
          }
        : {}),
      ...(q
        ? {
            OR: [
              { notes: { contains: q } },
              { menu: { is: { name: { contains: q } } } },
              { staff: { is: { name: { contains: q } } } },
              {
                customer: {
                  is: {
                    OR: [
                      { lastName: { contains: q } },
                      { firstName: { contains: q } },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    };

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        staff: { select: { name: true } },
        customer: { select: { lastName: true, firstName: true } },
        menu: { select: { name: true } },
      },
      orderBy: sort === "start_asc" ? { startAt: "asc" } : { startAt: "desc" },
      take: 5000,
    });

    const csv = toCsv(
      [
        "id",
        "status",
        "staff",
        "customer",
        "menu",
        "startAt",
        "endAt",
        "notes",
        "createdAt",
      ],
      appointments.map((appointment: (typeof appointments)[number]) => [
        appointment.id,
        appointment.status,
        appointment.staff.name,
        appointment.customer
          ? `${appointment.customer.lastName} ${appointment.customer.firstName}`
          : "",
        appointment.menu?.name ?? "",
        appointment.startAt.toISOString(),
        appointment.endAt.toISOString(),
        appointment.notes ?? "",
        appointment.createdAt.toISOString(),
      ]),
    );

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="appointments.csv"',
      },
    });
  }

  if (kind === "payments") {
    const where = {
      tenantId,
      ...(staffId ? { staffId } : {}),
      ...(method && ["CASH", "CARD", "QR"].includes(method)
        ? { method: method as "CASH" | "CARD" | "QR" }
        : {}),
      ...(fromValid || toEndExclusive
        ? {
            paidAt: {
              ...(fromValid ? { gte: fromValid } : {}),
              ...(toEndExclusive ? { lt: toEndExclusive } : {}),
            },
          }
        : {}),
      ...(q
        ? {
            OR: [
              { note: { contains: q } },
              { staff: { is: { name: { contains: q } } } },
              {
                customer: {
                  is: {
                    OR: [
                      { lastName: { contains: q } },
                      { firstName: { contains: q } },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    };

    const payments = await prisma.payment.findMany({
      where,
      include: {
        staff: { select: { name: true } },
        customer: { select: { lastName: true, firstName: true } },
      },
      orderBy: sort === "paid_asc" ? { paidAt: "asc" } : { paidAt: "desc" },
      take: 5000,
    });

    const csv = toCsv(
      [
        "id",
        "amount",
        "method",
        "paidAt",
        "staff",
        "customer",
        "appointmentId",
        "note",
        "createdAt",
      ],
      payments.map((payment: (typeof payments)[number]) => [
        payment.id,
        payment.amount,
        payment.method,
        payment.paidAt.toISOString(),
        payment.staff?.name ?? "",
        payment.customer
          ? `${payment.customer.lastName} ${payment.customer.firstName}`
          : "",
        payment.appointmentId ?? "",
        payment.note ?? "",
        payment.createdAt.toISOString(),
      ]),
    );

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="payments.csv"',
      },
    });
  }

  return new NextResponse("Invalid export kind", { status: 400 });
}
