import { prisma } from "@/lib/prisma";

export type InAppNotification = {
  id: string;
  level: "info" | "warning";
  priority: number;
  count: number;
  title: string;
  message: string;
  href: string;
};

function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export async function getInAppNotifications(tenantId: string) {
  const now = new Date();
  const todayStart = startOfDay(now);
  const tomorrowStart = addDays(todayStart, 1);

  const [unpaidCompletedCount, todayBookedCount, cautionCustomers] =
    await Promise.all([
      prisma.appointment.count({
        where: {
          tenantId,
          status: "COMPLETED",
          payment: null,
        },
      }),
      prisma.appointment.count({
        where: {
          tenantId,
          status: "BOOKED",
          startAt: { gte: todayStart, lt: tomorrowStart },
        },
      }),
      prisma.customer.count({
        where: {
          tenantId,
          tags: { contains: "CAUTION" },
        },
      }),
    ]);

  const notifications: InAppNotification[] = [];

  if (unpaidCompletedCount > 0) {
    notifications.push({
      id: "unpaid-completed",
      level: "warning",
      priority: 100,
      count: unpaidCompletedCount,
      title: "未会計の来店完了予約",
      message: `${unpaidCompletedCount} 件の会計待ちがあります。`,
      href: "/payments",
    });
  }

  if (todayBookedCount > 0) {
    notifications.push({
      id: "today-bookings",
      level: "info",
      priority: 50,
      count: todayBookedCount,
      title: "本日の予約",
      message: `${todayBookedCount} 件の予約が本日入っています。`,
      href: "/appointments",
    });
  }

  if (cautionCustomers > 0) {
    notifications.push({
      id: "caution-customers",
      level: "warning",
      priority: 80,
      count: cautionCustomers,
      title: "要注意顧客タグ",
      message: `要注意タグの顧客が ${cautionCustomers} 人います。`,
      href: "/customers?tag=CAUTION",
    });
  }

  return notifications.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    if (a.level !== b.level) return a.level === "warning" ? -1 : 1;
    return b.count - a.count;
  });
}
