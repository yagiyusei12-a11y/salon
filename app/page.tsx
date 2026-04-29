import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { SignOutButton } from "@/components/sign-out-button";
import { authOptions } from "@/lib/auth";
import { getInAppNotifications, type InAppNotification } from "@/lib/notifications";
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

function toDateParam(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
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
  const staffNameMap = new Map<string, string>(
    staffNames.map((staff: (typeof staffNames)[number]) => [staff.id, staff.name]),
  );

  const dailyRanges = Array.from({ length: 7 }, (_: unknown, index: number) => {
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
  const dailySales = dailyRanges.map((range: (typeof dailyRanges)[number], index: number) => ({
    date: range.key,
    amount: dailyAggregates[index]._sum.amount ?? 0,
  }));

  const maxDailySales = Math.max(...dailySales.map((day: (typeof dailySales)[number]) => day.amount), 1);
  const last7From = sevenDaysAgo.toISOString().slice(0, 10);
  const last7To = todayStart.toISOString().slice(0, 10);
  const todayDateParam = toDateParam(now);

  const todayTotal = todayPaymentSummary._sum.amount ?? 0;
  const todayPaymentCount = todayPaymentSummary._count.id;
  const notifications = await getInAppNotifications(tenantId);
  const warningNotificationCount = notifications.filter(
    (notification: InAppNotification) => notification.level === "warning",
  ).length;

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <header className="mb-8 flex flex-col gap-4 border-b border-gray-200 pb-8 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
            ホーム
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-gray-900">ダッシュボード</h1>
          <p className="mt-1 text-sm text-gray-600">
            ようこそ、<span className="font-medium text-gray-800">{session.user.name}</span>
            さん（
            {session.user.role === "OWNER" ? "オーナー" : "スタッフ"}
            ）
          </p>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-500">
            下の「今日の業務」からいつもの操作へ。数字のサマリーはその下にあります。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <Link
            href="/notifications"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm hover:bg-gray-50"
          >
            <span aria-hidden>🔔</span>
            通知
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
              {notifications.length}
            </span>
          </Link>
          {warningNotificationCount > 0 && (
            <span className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-900">
              要確認 {warningNotificationCount}
            </span>
          )}
          <SignOutButton />
        </div>
      </header>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">今日の業務</h2>
        <p className="mb-4 text-xs text-gray-500">
          よく使う画面へすぐ移動できます。
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href={`/appointments?view=day&date=${todayDateParam}`}
            className="flex flex-col rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50"
          >
            <span className="text-lg" aria-hidden>
              📅
            </span>
            <span className="mt-2 font-medium text-gray-900">今日の予約</span>
            <span className="mt-1 text-xs leading-snug text-gray-600">
              日表示で今日の予約・受付を確認
            </span>
          </Link>
          <Link
            href="/customers"
            className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-emerald-200 hover:bg-gray-50"
          >
            <span className="text-lg" aria-hidden>
              👤
            </span>
            <span className="mt-2 font-medium text-gray-900">顧客</span>
            <span className="mt-1 text-xs leading-snug text-gray-600">
              新規登録・検索・カルテの確認
            </span>
          </Link>
          <Link
            href="/payments"
            className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-emerald-200 hover:bg-gray-50"
          >
            <span className="text-lg" aria-hidden>
              💴
            </span>
            <span className="mt-2 font-medium text-gray-900">会計</span>
            <span className="mt-1 text-xs leading-snug text-gray-600">
              会計登録と売上の確認
            </span>
          </Link>
          <Link
            href="/appointments"
            className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-emerald-200 hover:bg-gray-50"
          >
            <span className="text-lg" aria-hidden>
              📋
            </span>
            <span className="mt-2 font-medium text-gray-900">予約一覧</span>
            <span className="mt-1 text-xs leading-snug text-gray-600">
              検索・カレンダー・新規予約
            </span>
          </Link>
        </div>
      </section>

      <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-xs font-medium text-gray-500">本日の売上</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-gray-900">
            {todayTotal.toLocaleString("ja-JP")} 円
          </p>
          <p className="mt-2 text-xs text-gray-500">今日入金した会計の合計</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-xs font-medium text-gray-500">本日の会計件数</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-gray-900">{todayPaymentCount} 件</p>
          <p className="mt-2 text-xs text-gray-500">今日登録した会計の件数</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-xs font-medium text-gray-500">登録顧客数</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-gray-900">{totalCustomers} 人</p>
          <p className="mt-2 text-xs text-gray-500">店舗に登録されている顧客の総数</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-xs font-medium text-gray-500">本日の予約件数</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-gray-900">{totalAppointments} 件</p>
          <p className="mt-2 text-xs text-gray-500">今日の「予約中」の件数</p>
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
              .map((payment: (typeof recentPaymentRows)[number], index: number) => (
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

      <section className="space-y-10">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">その他のショートカット</h2>
          <p className="mt-1 text-xs text-gray-500">
            日付や条件を付けた画面へすぐ飛びます。
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Link
              href="/customers"
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-emerald-200 hover:shadow"
            >
              <h3 className="text-lg font-medium text-gray-900">顧客管理（一覧）</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                検索・タグ・CSV。新規登録もここから行います。
              </p>
            </Link>
            <Link
              href="/customers?tag=VIP"
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-emerald-200 hover:shadow"
            >
              <h3 className="text-lg font-medium text-gray-900">VIP顧客だけ表示</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                VIPタグが付いた顧客に絞り込みます。
              </p>
            </Link>
            <Link
              href={`/appointments?from=${last7From}&to=${last7To}&sort=start_desc`}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-emerald-200 hover:shadow"
            >
              <h3 className="text-lg font-medium text-gray-900">予約（直近7日）</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                直近1週間の予約を新しい順で開きます。カレンダーや新規登録も同じ画面内です。
              </p>
            </Link>
            <Link
              href={`/payments?from=${last7From}&to=${last7To}&sort=paid_desc`}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-emerald-200 hover:shadow"
            >
              <h3 className="text-lg font-medium text-gray-900">会計（直近7日）</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                直近1週間の会計履歴を新しい順で開きます。
              </p>
            </Link>
          </div>
        </div>

        {session.user.role === "OWNER" && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-emerald-900">オーナー専用メニュー</h2>
            <p className="mt-1 text-xs text-emerald-800/90">
              メニュー料金・スタッフアカウント・ログ・バックアップは、オーナー権限でのみ表示されます。
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Link
                href="/menus"
                className="rounded-xl border border-white bg-white p-5 shadow-sm transition hover:border-emerald-200"
              >
                <h3 className="text-lg font-medium text-gray-900">メニュー管理</h3>
                <p className="mt-2 text-sm text-gray-600">
                  施術メニューの追加・価格・所要時間の編集・削除。
                </p>
              </Link>
              <Link
                href="/staff"
                className="rounded-xl border border-white bg-white p-5 shadow-sm transition hover:border-emerald-200"
              >
                <h3 className="text-lg font-medium text-gray-900">スタッフ管理</h3>
                <p className="mt-2 text-sm text-gray-600">
                  <strong className="font-medium text-gray-800">ログイン用アカウントの追加</strong>
                  と、権限・有効/無効の切り替え。
                </p>
              </Link>
              <Link
                href="/audit-logs"
                className="rounded-xl border border-white bg-white p-5 shadow-sm transition hover:border-emerald-200"
              >
                <h3 className="text-lg font-medium text-gray-900">監査ログ</h3>
                <p className="mt-2 text-sm text-gray-600">誰がいつ、どの操作をしたかの記録。</p>
              </Link>
              <Link
                href="/backup"
                className="rounded-xl border border-white bg-white p-5 shadow-sm transition hover:border-emerald-200"
              >
                <h3 className="text-lg font-medium text-gray-900">バックアップ</h3>
                <p className="mt-2 text-sm text-gray-600">
                  データのJSONエクスポートと復元（上書き）。取り扱いに注意。
                </p>
              </Link>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
