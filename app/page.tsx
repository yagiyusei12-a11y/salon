import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { SignOutButton } from "@/components/sign-out-button";
import { authOptions } from "@/lib/auth";
import { getInAppNotifications } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

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

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.tenantId) {
    redirect("/login");
  }

  const tenantId = session.user.tenantId;
  const now = new Date();
  const todayStart = startOfDay(now);
  const tomorrowStart = addDays(todayStart, 1);
  const sevenDaysAgo = addDays(todayStart, -6);

  const [
    todayPaymentSummary,
    paymentMethodSummary,
    staffSalesSummary,
    recentPaymentRows,
    totalCustomers,
    totalAppointments,
    unpaidCompletedAppointments,
  ] = await Promise.all([
    prisma.payment.aggregate({
      where: {
        tenantId,
        paidAt: { gte: todayStart, lt: tomorrowStart },
      },
      _sum: { amount: true },
      _count: { id: true },
    }),
    prisma.payment.groupBy({
      by: ["method"],
      where: { tenantId },
      _sum: { amount: true },
    }),
    prisma.payment.groupBy({
      by: ["staffId"],
      where: { tenantId, staffId: { not: null } },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
      take: 5,
    }),
    prisma.payment.findMany({
      where: { tenantId, paidAt: { gte: sevenDaysAgo, lt: tomorrowStart } },
      select: { amount: true, paidAt: true },
      orderBy: { paidAt: "desc" },
      take: 6,
    }),
    prisma.customer.count({ where: { tenantId } }),
    prisma.appointment.count({
      where: {
        tenantId,
        status: "BOOKED",
        startAt: { gte: todayStart, lt: tomorrowStart },
      },
    }),
    prisma.appointment.count({
      where: {
        tenantId,
        status: "COMPLETED",
        payment: null,
      },
    }),
  ]);

  const staffIds = staffSalesSummary
    .map((row: (typeof staffSalesSummary)[number]) => row.staffId)
    .filter((id: string | null): id is string => Boolean(id));

  const staffNames = await prisma.user.findMany({
    where: { id: { in: staffIds }, tenantId },
    select: { id: true, name: true },
  });
  const staffNameMap = new Map(
    staffNames.map((staff: (typeof staffNames)[number]) => [staff.id, staff.name]),
  );

  const dailyRanges = Array.from({ length: 7 }, (_, index) => {
    const dayStart = addDays(sevenDaysAgo, index);
    return {
      key: dayStart.toISOString().slice(0, 10),
      start: dayStart,
      end: addDays(dayStart, 1),
    };
  });
  const dailyAggregates = await Promise.all(
    dailyRanges.map((range: (typeof dailyRanges)[number]) =>
      prisma.payment.aggregate({
        where: {
          tenantId,
          paidAt: { gte: range.start, lt: range.end },
        },
        _sum: { amount: true },
      }),
    ),
  );
  const dailySales = dailyRanges.map((range: (typeof dailyRanges)[number], index) => ({
    date: range.key,
    amount: dailyAggregates[index]._sum.amount ?? 0,
  }));

  const maxDailySales = Math.max(...dailySales.map((day: (typeof dailySales)[number]) => day.amount), 1);
  const last7From = sevenDaysAgo.toISOString().slice(0, 10);
  const last7To = todayStart.toISOString().slice(0, 10);

  const todayTotal = todayPaymentSummary._sum.amount ?? 0;
  const todayPaymentCount = todayPaymentSummary._count.id;
  const notifications = await getInAppNotifications(tenantId);
  const warningNotificationCount = notifications.filter(
    (notification) => notification.level === "warning",
  ).length;

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">サロン管理ダッシュボード</h1>
          <p className="text-sm text-gray-600">
            {session.user.name} ({session.user.role}) でログイン中
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/notifications" className="text-sm text-emerald-700 hover:underline">
            通知 ({notifications.length})
          </Link>
          {warningNotificationCount > 0 && (
            <span className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800">
              重要 {warningNotificationCount}
            </span>
          )}
          <SignOutButton />
        </div>
      </header>

      <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-600">本日の売上</p>
          <p className="mt-2 text-2xl font-semibold">
            {todayTotal.toLocaleString("ja-JP")} 円
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-600">本日の会計件数</p>
          <p className="mt-2 text-2xl font-semibold">{todayPaymentCount} 件</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-600">登録顧客数</p>
          <p className="mt-2 text-2xl font-semibold">{totalCustomers} 人</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-600">本日の予約件数</p>
          <p className="mt-2 text-2xl font-semibold">{totalAppointments} 件</p>
        </div>
      </section>

      {unpaidCompletedAppointments > 0 && (
        <section className="mb-8 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">
            来店完了で未会計の予約が {unpaidCompletedAppointments} 件あります。
          </p>
          <Link href="/payments" className="mt-1 inline-block text-sm text-amber-800 underline">
            会計管理で確認
          </Link>
        </section>
      )}

      <section className="mb-8 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5 lg:col-span-2">
          <h2 className="mb-4 text-lg font-medium">直近7日 売上推移</h2>
          <div className="space-y-3">
            {dailySales.map((day: (typeof dailySales)[number]) => {
              const width = Math.max(
                6,
                Math.round((day.amount / maxDailySales) * 100),
              );
              return (
                <div key={day.date} className="grid grid-cols-[96px_1fr_90px] items-center gap-3">
                  <span className="text-xs text-gray-600">{day.date.slice(5)}</span>
                  <div className="h-3 rounded-full bg-gray-100">
                    <div
                      className="h-3 rounded-full bg-emerald-500"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  <span className="text-right text-sm text-gray-700">
                    {day.amount.toLocaleString("ja-JP")}円
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-lg font-medium">支払い方法比率</h2>
          <div className="space-y-3">
            {paymentMethodSummary.map((row: (typeof paymentMethodSummary)[number]) => (
              <div key={row.method} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">
                  {row.method === "CASH"
                    ? "現金"
                    : row.method === "CARD"
                      ? "カード"
                      : "QR"}
                </span>
                <span className="font-medium text-gray-900">
                  {(row._sum.amount ?? 0).toLocaleString("ja-JP")}円
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mb-8 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-lg font-medium">スタッフ別売上（上位5名）</h2>
          <div className="space-y-3">
            {staffSalesSummary.length === 0 ? (
              <p className="text-sm text-gray-500">会計データがありません。</p>
            ) : (
              staffSalesSummary.map((row: (typeof staffSalesSummary)[number]) => (
                <div key={row.staffId} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">
                    {row.staffId ? staffNameMap.get(row.staffId) ?? "不明スタッフ" : "未設定"}
                  </span>
                  <span className="font-medium text-gray-900">
                    {(row._sum.amount ?? 0).toLocaleString("ja-JP")}円
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-lg font-medium">最近の会計（7日）</h2>
          <div className="space-y-2 text-sm">
            {recentPaymentRows
              .map((payment: (typeof recentPaymentRows)[number], index) => (
                <div
                  key={`${payment.paidAt.toISOString()}-${index}`}
                  className="flex items-center justify-between border-b border-gray-100 py-1"
                >
                  <span className="text-gray-700">
                    {new Intl.DateTimeFormat("ja-JP", {
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(payment.paidAt)}
                  </span>
                  <span className="font-medium text-gray-900">
                    {payment.amount.toLocaleString("ja-JP")}円
                  </span>
                </div>
              ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/customers"
          className="rounded-xl border border-gray-200 p-5 hover:bg-gray-50"
        >
          <h2 className="mb-2 text-lg font-medium">顧客管理</h2>
          <p className="text-sm text-gray-600">顧客の登録・検索・更新を行います。</p>
        </Link>
        <Link
          href="/customers?tag=VIP"
          className="rounded-xl border border-gray-200 p-5 hover:bg-gray-50"
        >
          <h2 className="mb-2 text-lg font-medium">VIP顧客</h2>
          <p className="text-sm text-gray-600">VIPタグの顧客を素早く確認します。</p>
        </Link>
        <Link
          href={`/appointments?from=${last7From}&to=${last7To}&sort=start_desc`}
          className="rounded-xl border border-gray-200 p-5 hover:bg-gray-50"
        >
          <h2 className="mb-2 text-lg font-medium">予約管理</h2>
          <p className="text-sm text-gray-600">
            スタッフ別の予約登録と重複チェックを行います（直近7日で表示）。
          </p>
        </Link>
        {session.user.role === "OWNER" && (
          <Link
            href="/menus"
            className="rounded-xl border border-gray-200 p-5 hover:bg-gray-50"
          >
            <h2 className="mb-2 text-lg font-medium">メニュー管理</h2>
            <p className="text-sm text-gray-600">
              施術メニューの追加・更新・削除を行います。
            </p>
          </Link>
        )}
        {session.user.role === "OWNER" && (
          <Link
            href="/staff"
            className="rounded-xl border border-gray-200 p-5 hover:bg-gray-50"
          >
            <h2 className="mb-2 text-lg font-medium">スタッフ管理</h2>
            <p className="text-sm text-gray-600">
              スタッフ追加とロール/有効状態の管理を行います。
            </p>
          </Link>
        )}
        {session.user.role === "OWNER" && (
          <Link
            href="/audit-logs"
            className="rounded-xl border border-gray-200 p-5 hover:bg-gray-50"
          >
            <h2 className="mb-2 text-lg font-medium">監査ログ</h2>
            <p className="text-sm text-gray-600">
              主要操作の履歴（誰が何をしたか）を確認します。
            </p>
          </Link>
        )}
        {session.user.role === "OWNER" && (
          <Link
            href="/backup"
            className="rounded-xl border border-gray-200 p-5 hover:bg-gray-50"
          >
            <h2 className="mb-2 text-lg font-medium">バックアップ</h2>
            <p className="text-sm text-gray-600">
              JSONでのエクスポート/復元（全置換）を実行します。
            </p>
          </Link>
        )}
        <Link
          href={`/payments?from=${last7From}&to=${last7To}&sort=paid_desc`}
          className="rounded-xl border border-gray-200 p-5 hover:bg-gray-50"
        >
          <h2 className="mb-2 text-lg font-medium">会計管理</h2>
          <p className="text-sm text-gray-600">
            会計登録と日次売上の確認を行います（直近7日で表示）。
          </p>
        </Link>
      </section>
    </main>
  );
}
