import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";

import { createPayment } from "@/app/payments/actions";
import { FilterSummary } from "@/components/filter-summary";
import { FormResultAlert } from "@/components/form-result-alert";
import { LastUpdatedAt } from "@/components/last-updated-at";
import { SubmitButton } from "@/components/submit-button";
import { authOptions } from "@/lib/auth";
import {
  exportApiHref,
  pathnameWithSearch,
  setIfNonEmpty,
  setSortUnlessDefault,
  withDateRange,
} from "@/lib/list-query";
import { prisma } from "@/lib/prisma";

function toDateTimeLocalValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function floorToFiveMinutes(date: Date) {
  const floored = new Date(date);
  floored.setSeconds(0, 0);
  floored.setMinutes(Math.floor(floored.getMinutes() / 5) * 5);
  return floored;
}

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

type Props = {
  searchParams?: Promise<{
    appointmentId?: string;
    q?: string;
    staffId?: string;
    method?: string;
    from?: string;
    to?: string;
    sort?: string;
    result?: string;
    message?: string;
  }>;
};

export default async function PaymentsPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    redirect("/login");
  }

  const tenantId = session.user.tenantId;
  const resolvedParams = (await searchParams) ?? {};
  const q = (resolvedParams.q ?? "").trim();
  const selectedStaffId = (resolvedParams.staffId ?? "").trim();
  const selectedMethod = (resolvedParams.method ?? "").trim();
  const selectedSort = (resolvedParams.sort ?? "paid_desc").trim();
  const fromDateRaw = (resolvedParams.from ?? "").trim();
  const toDateRaw = (resolvedParams.to ?? "").trim();
  const result = (resolvedParams.result ?? "").trim();
  const message = (resolvedParams.message ?? "").trim();
  const requestedAppointmentId = (resolvedParams.appointmentId ?? "").trim();
  const returnToQuery = new URLSearchParams();
  setIfNonEmpty(returnToQuery, "appointmentId", requestedAppointmentId);
  setIfNonEmpty(returnToQuery, "q", q);
  setIfNonEmpty(returnToQuery, "staffId", selectedStaffId);
  setIfNonEmpty(returnToQuery, "method", selectedMethod);
  setSortUnlessDefault(returnToQuery, "sort", selectedSort, "paid_desc");
  setIfNonEmpty(returnToQuery, "from", fromDateRaw);
  setIfNonEmpty(returnToQuery, "to", toDateRaw);
  const returnTo = pathnameWithSearch("/payments", returnToQuery);
  const exportHref = exportApiHref("payments", returnToQuery);
  const now = new Date();
  const todayStart = startOfDay(now);
  const tomorrowStart = addDays(todayStart, 1);

  const fromDate = fromDateRaw ? new Date(fromDateRaw) : null;
  const toDate = toDateRaw ? new Date(toDateRaw) : null;
  const fromDateStart =
    fromDate && !Number.isNaN(fromDate.getTime()) ? startOfDay(fromDate) : null;
  const toDateEndExclusive =
    toDate && !Number.isNaN(toDate.getTime()) ? addDays(startOfDay(toDate), 1) : null;

  const paymentsFilterWhere: Prisma.PaymentWhereInput = {
    tenantId,
    ...(selectedStaffId ? { staffId: selectedStaffId } : {}),
    ...(selectedMethod && ["CASH", "CARD", "QR"].includes(selectedMethod)
      ? { method: selectedMethod as "CASH" | "CARD" | "QR" }
      : {}),
    ...(fromDateStart || toDateEndExclusive
      ? {
          paidAt: {
            ...(fromDateStart ? { gte: fromDateStart } : {}),
            ...(toDateEndExclusive ? { lt: toDateEndExclusive } : {}),
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

  const [
    staffList,
    customerList,
    appointmentList,
    unpaidAppointments,
    payments,
    todaySummary,
    filteredSummary,
  ] =
    await Promise.all([
      prisma.user.findMany({
        where: { tenantId, isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.customer.findMany({
        where: { tenantId },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        take: 200,
        select: { id: true, lastName: true, firstName: true },
      }),
      prisma.appointment.findMany({
        where: { tenantId, status: "COMPLETED" },
        orderBy: { startAt: "desc" },
        take: 100,
        select: {
          id: true,
          startAt: true,
          menu: { select: { price: true } },
          staffId: true,
          customerId: true,
          customer: { select: { lastName: true, firstName: true } },
          payment: { select: { id: true } },
        },
      }),
      prisma.appointment.findMany({
        where: { tenantId, status: "COMPLETED", payment: null },
        orderBy: { startAt: "asc" },
        take: 20,
        select: {
          id: true,
          startAt: true,
          endAt: true,
          staff: { select: { name: true } },
          customer: { select: { lastName: true, firstName: true } },
          menu: { select: { name: true, price: true } },
        },
      }),
      prisma.payment.findMany({
        where: paymentsFilterWhere,
        include: {
          staff: { select: { name: true } },
          customer: { select: { lastName: true, firstName: true } },
        },
        orderBy: selectedSort === "paid_asc" ? { paidAt: "asc" } : { paidAt: "desc" },
        take: 300,
      }),
      prisma.payment.aggregate({
        where: {
          tenantId,
          paidAt: {
            gte: todayStart,
            lt: tomorrowStart,
          },
        },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.payment.aggregate({
        where: paymentsFilterWhere,
        _sum: { amount: true },
        _count: { id: true },
      }),
    ]);

  const payableAppointments = appointmentList.filter((appointment) => !appointment.payment);
  const selectedAppointment =
    payableAppointments.find((appointment) => appointment.id === requestedAppointmentId) ?? null;
  const selectedAppointmentId = selectedAppointment?.id ?? "";
  const defaultAmount = selectedAppointment?.menu?.price ?? "";
  const defaultStaffId = selectedAppointment?.staffId ?? "";
  const defaultCustomerId = selectedAppointment?.customerId ?? "";

  const todayTotal = todaySummary._sum.amount ?? 0;
  const todayCount = todaySummary._count.id;
  const filteredTotal = filteredSummary._sum.amount ?? 0;
  const filteredCount = filteredSummary._count.id;
  const todayDateParam = toDateParam(now);
  const weekStartDateParam = toDateParam(todayStart);
  const weekEndDateParam = toDateParam(addDays(todayStart, 6));
  const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
  const monthEnd = new Date(todayStart.getFullYear(), todayStart.getMonth() + 1, 0);
  const monthStartDateParam = toDateParam(monthStart);
  const monthEndDateParam = toDateParam(monthEnd);
  const createRangePresetHref = (from: string, to: string) =>
    pathnameWithSearch("/payments", withDateRange(returnToQuery, from, to));

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">会計管理</h1>
          <p className="text-sm text-gray-600">会計登録と日次売上の確認</p>
          <LastUpdatedAt />
        </div>
        <div className="flex items-center gap-3">
          <a
            href={exportHref}
            className="text-sm text-emerald-700 hover:underline"
          >
            CSV出力
          </a>
          <Link href="/" className="text-sm text-emerald-700 hover:underline">
            ダッシュボードへ戻る
          </Link>
        </div>
      </header>
      <FormResultAlert status={result} message={message} />

      <section className="mb-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-medium text-gray-600">本日の売上</h2>
          <p className="mt-2 text-2xl font-semibold">
            {todayTotal.toLocaleString("ja-JP")} 円
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-medium text-gray-600">本日の会計件数</h2>
          <p className="mt-2 text-2xl font-semibold">{todayCount} 件</p>
        </div>
      </section>

      <section className="mb-8 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-lg font-medium">検索・集計フィルター</h2>
        <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {selectedAppointmentId && (
            <input type="hidden" name="appointmentId" value={selectedAppointmentId} />
          )}
          <input
            name="q"
            defaultValue={q}
            placeholder="顧客/スタッフ/メモ"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm lg:col-span-2"
          />
          <select
            name="staffId"
            defaultValue={selectedStaffId}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">全スタッフ</option>
            {staffList.map((staff) => (
              <option key={staff.id} value={staff.id}>
                {staff.name}
              </option>
            ))}
          </select>
          <select
            name="method"
            defaultValue={selectedMethod}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">全支払い方法</option>
            <option value="CASH">現金</option>
            <option value="CARD">カード</option>
            <option value="QR">QR</option>
          </select>
          <select
            name="sort"
            defaultValue={selectedSort}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="paid_desc">会計日時: 新しい順</option>
            <option value="paid_asc">会計日時: 古い順</option>
          </select>
          <input
            type="date"
            name="from"
            defaultValue={fromDateRaw}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            type="date"
            name="to"
            defaultValue={toDateRaw}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 lg:col-span-6"
          >
            適用
          </button>
        </form>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-gray-500">日付プリセット:</span>
          <Link
            href={createRangePresetHref(todayDateParam, todayDateParam)}
            className="rounded-md border border-gray-300 px-2 py-1 text-gray-700 hover:bg-gray-50"
          >
            今日
          </Link>
          <Link
            href={createRangePresetHref(weekStartDateParam, weekEndDateParam)}
            className="rounded-md border border-gray-300 px-2 py-1 text-gray-700 hover:bg-gray-50"
          >
            今週
          </Link>
          <Link
            href={createRangePresetHref(monthStartDateParam, monthEndDateParam)}
            className="rounded-md border border-gray-300 px-2 py-1 text-gray-700 hover:bg-gray-50"
          >
            今月
          </Link>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-md border border-gray-300 px-2 py-1 text-gray-700">
            絞り込み件数 {filteredCount}
          </span>
          <span className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-emerald-700">
            絞り込み売上 {filteredTotal.toLocaleString("ja-JP")} 円
          </span>
        </div>
      </section>

      <section className="mb-8 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-lg font-medium">未会計（来店完了）予約（最新20件）</h2>
        <div className="space-y-2">
          {unpaidAppointments.length === 0 ? (
            <p className="text-sm text-gray-500">未会計の来店完了予約はありません。</p>
          ) : (
            unpaidAppointments.map((appointment) => (
              <div
                key={appointment.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
              >
                <div>
                  <div className="font-medium text-gray-900">
                    {new Intl.DateTimeFormat("ja-JP", {
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(appointment.startAt)}
                    {" - "}
                    {new Intl.DateTimeFormat("ja-JP", {
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(appointment.endAt)}
                  </div>
                  <div className="text-gray-700">
                    {appointment.staff.name}
                    {" / "}
                    {appointment.customer
                      ? `${appointment.customer.lastName} ${appointment.customer.firstName}`
                      : "顧客未指定"}
                    {" / "}
                    {appointment.menu?.name ?? "メニュー未指定"}
                  </div>
                </div>
                <Link
                  href={`/payments?appointmentId=${appointment.id}`}
                  className="rounded-md border border-emerald-300 px-3 py-1.5 text-sm text-emerald-700 hover:bg-emerald-50"
                >
                  この予約で会計
                </Link>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="mb-8 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-lg font-medium">会計登録</h2>
        <form action={createPayment} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="returnTo" value={returnTo} />
          <label className="text-sm text-gray-700">
            金額（円）
            <input
              type="number"
              name="amount"
              min={1}
              max={9999999}
              step={1}
              defaultValue={defaultAmount}
              required
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <span className="mt-1 block text-xs text-gray-500">1〜9,999,999円（100円単位推奨）</span>
          </label>
          <label className="text-sm text-gray-700">
            支払い方法
            <select
              name="method"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              defaultValue="CASH"
            >
              <option value="CASH">現金</option>
              <option value="CARD">カード</option>
              <option value="QR">QR</option>
            </select>
          </label>
          <label className="text-sm text-gray-700">
            会計日時
            <input
              type="datetime-local"
              name="paidAt"
              required
              defaultValue={toDateTimeLocalValue(floorToFiveMinutes(new Date()))}
              step={300}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <span className="mt-1 block text-xs text-gray-500">5分単位で入力してください。</span>
          </label>
          <label className="text-sm text-gray-700">
            対象予約（任意）
            <select
              name="appointmentId"
              defaultValue={selectedAppointmentId}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">未選択</option>
              {payableAppointments.map((appointment) => (
                <option key={appointment.id} value={appointment.id}>
                  {new Intl.DateTimeFormat("ja-JP", {
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(appointment.startAt)}
                  {" / "}
                  {appointment.customer
                    ? `${appointment.customer.lastName} ${appointment.customer.firstName}`
                    : "顧客未指定"}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-gray-700">
            担当スタッフ（任意）
            <select
              name="staffId"
              defaultValue={defaultStaffId}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">未選択</option>
              {staffList.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-gray-700">
            顧客（任意）
            <select
              name="customerId"
              defaultValue={defaultCustomerId}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">未選択</option>
              {customerList.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.lastName} {customer.firstName}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-gray-700 sm:col-span-2">
            メモ（任意）
            <textarea
              name="note"
              rows={3}
              maxLength={500}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <span className="mt-1 block text-xs text-gray-500">500文字以内</span>
          </label>
          <SubmitButton
            className="sm:col-span-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            pendingText="登録中..."
          >
            会計を登録
          </SubmitButton>
        </form>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-medium">会計履歴（最大300件）</h2>
          <span className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700">
            表示件数 {payments.length}
          </span>
        </div>
        <FilterSummary
          items={[
            { key: "q", value: q },
            { key: "staff", value: selectedStaffId },
            { key: "method", value: selectedMethod },
            { key: "from", value: fromDateRaw },
            { key: "to", value: toDateRaw },
            { key: "sort", value: selectedSort },
          ]}
        />
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="p-2 font-medium">日時</th>
                <th className="p-2 font-medium">金額</th>
                <th className="p-2 font-medium">方法</th>
                <th className="p-2 font-medium">スタッフ</th>
                <th className="p-2 font-medium">顧客</th>
                <th className="p-2 font-medium">メモ</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id} className="border-b border-gray-100">
                  <td className="p-2">
                    {new Intl.DateTimeFormat("ja-JP", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(payment.paidAt)}
                  </td>
                  <td className="p-2">{payment.amount.toLocaleString("ja-JP")} 円</td>
                  <td className="p-2">
                    {payment.method === "CASH"
                      ? "現金"
                      : payment.method === "CARD"
                        ? "カード"
                        : "QR"}
                  </td>
                  <td className="p-2">{payment.staff?.name ?? "-"}</td>
                  <td className="p-2">
                    {payment.customer
                      ? `${payment.customer.lastName} ${payment.customer.firstName}`
                      : "-"}
                  </td>
                  <td className="p-2">{payment.note ?? "-"}</td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr>
                  <td className="p-3 text-center text-sm text-gray-500" colSpan={6}>
                    条件に一致する会計履歴はありません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
