import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import {
  cancelAppointment,
  completeAppointment,
  createAppointment,
} from "@/app/appointments/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
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

function toDateParam(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
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

type Props = {
  searchParams?: Promise<{
    view?: string;
    date?: string;
    customerId?: string;
    q?: string;
    staffId?: string;
    status?: string;
    from?: string;
    to?: string;
    sort?: string;
    result?: string;
    message?: string;
  }>;
};

export default async function AppointmentsPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.tenantId) {
    redirect("/login");
  }

  const tenantId = session.user.tenantId;
  const resolvedParams = (await searchParams) ?? {};
  const view = resolvedParams.view === "week" ? "week" : "day";
  const preselectedCustomerId = (resolvedParams.customerId ?? "").trim();
  const q = (resolvedParams.q ?? "").trim();
  const selectedStaffId = (resolvedParams.staffId ?? "").trim();
  const selectedStatus = (resolvedParams.status ?? "").trim();
  const selectedSort = (resolvedParams.sort ?? "start_asc").trim();
  const fromDateRaw = (resolvedParams.from ?? "").trim();
  const toDateRaw = (resolvedParams.to ?? "").trim();
  const result = (resolvedParams.result ?? "").trim();
  const message = (resolvedParams.message ?? "").trim();
  const baseDateRaw = resolvedParams.date ?? "";
  const returnToQuery = new URLSearchParams();
  returnToQuery.set("view", view);
  setIfNonEmpty(returnToQuery, "date", baseDateRaw);
  setIfNonEmpty(returnToQuery, "customerId", preselectedCustomerId);
  setIfNonEmpty(returnToQuery, "q", q);
  setIfNonEmpty(returnToQuery, "staffId", selectedStaffId);
  setIfNonEmpty(returnToQuery, "status", selectedStatus);
  setSortUnlessDefault(returnToQuery, "sort", selectedSort, "start_asc");
  setIfNonEmpty(returnToQuery, "from", fromDateRaw);
  setIfNonEmpty(returnToQuery, "to", toDateRaw);
  const returnTo = pathnameWithSearch("/appointments", returnToQuery);
  const exportHref = exportApiHref("appointments", returnToQuery);
  const baseDate = baseDateRaw ? new Date(baseDateRaw) : new Date();
  const calendarBaseDate = Number.isNaN(baseDate.getTime()) ? new Date() : baseDate;
  const calendarStart = startOfDay(calendarBaseDate);
  const calendarEnd =
    view === "week"
      ? addDays(calendarStart, 7)
      : addDays(calendarStart, 1);
  const previousDate = toDateParam(
    view === "week" ? addDays(calendarStart, -7) : addDays(calendarStart, -1),
  );
  const nextDate = toDateParam(
    view === "week" ? addDays(calendarStart, 7) : addDays(calendarStart, 1),
  );
  const currentDateParam = toDateParam(calendarStart);

  const fromDate = fromDateRaw ? new Date(fromDateRaw) : null;
  const toDate = toDateRaw ? new Date(toDateRaw) : null;
  const fromDateStart =
    fromDate && !Number.isNaN(fromDate.getTime()) ? startOfDay(fromDate) : null;
  const toDateEndExclusive =
    toDate && !Number.isNaN(toDate.getTime()) ? addDays(startOfDay(toDate), 1) : null;

  const todayStart = startOfDay(new Date());
  const tomorrowStart = addDays(todayStart, 1);

  const filteredWhere = {
    tenantId,
    ...(selectedStaffId ? { staffId: selectedStaffId } : {}),
    ...(selectedStatus && ["BOOKED", "COMPLETED", "CANCELLED"].includes(selectedStatus)
      ? { status: selectedStatus as "BOOKED" | "COMPLETED" | "CANCELLED" }
      : {}),
    ...(fromDateStart || toDateEndExclusive
      ? {
          startAt: {
            ...(fromDateStart ? { gte: fromDateStart } : {}),
            ...(toDateEndExclusive ? { lt: toDateEndExclusive } : {}),
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

  const [
    staffList,
    customerList,
    menuList,
    todayAppointments,
    calendarAppointments,
    appointments,
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
      select: { id: true, lastName: true, firstName: true },
      take: 200,
    }),
    prisma.serviceMenu.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, durationMinutes: true },
    }),
    prisma.appointment.findMany({
      where: {
        tenantId,
        startAt: { gte: todayStart, lt: tomorrowStart },
        status: { in: ["BOOKED", "COMPLETED"] },
      },
      include: {
        staff: { select: { name: true } },
        customer: { select: { id: true, lastName: true, firstName: true } },
        menu: { select: { name: true } },
        payment: { select: { id: true } },
      },
      orderBy: { startAt: "asc" },
    }),
    prisma.appointment.findMany({
      where: {
        tenantId,
        status: "BOOKED",
        startAt: {
          gte: calendarStart,
          lt: calendarEnd,
        },
      },
      include: {
        staff: { select: { id: true, name: true } },
        customer: { select: { lastName: true, firstName: true } },
        menu: { select: { name: true } },
        payment: { select: { id: true } },
      },
      orderBy: [{ staff: { name: "asc" } }, { startAt: "asc" }],
    }),
    prisma.appointment.findMany({
      where: filteredWhere,
      include: {
        staff: { select: { name: true } },
        customer: { select: { lastName: true, firstName: true } },
        menu: { select: { name: true } },
        payment: { select: { id: true } },
      },
      orderBy: selectedSort === "start_desc" ? { startAt: "desc" } : { startAt: "asc" },
      take: 300,
    }),
    ]);

  const defaultStartAt = toDateTimeLocalValue(new Date());
  const todayBookedCount = todayAppointments.filter(
    (appointment) => appointment.status === "BOOKED",
  ).length;
  const todayCompletedCount = todayAppointments.filter(
    (appointment) => appointment.status === "COMPLETED",
  ).length;
  const todayUnpaidCompletedCount = todayAppointments.filter(
    (appointment) => appointment.status === "COMPLETED" && !appointment.payment,
  ).length;
  const todayDateParam = toDateParam(new Date());
  const weekStartDateParam = toDateParam(todayStart);
  const weekEndDateParam = toDateParam(addDays(todayStart, 6));
  const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
  const monthEnd = new Date(todayStart.getFullYear(), todayStart.getMonth() + 1, 0);
  const monthStartDateParam = toDateParam(monthStart);
  const monthEndDateParam = toDateParam(monthEnd);
  const createRangePresetHref = (from: string, to: string) =>
    pathnameWithSearch("/appointments", withDateRange(returnToQuery, from, to));

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">予約管理</h1>
          <p className="text-sm text-gray-600">
            スタッフ重複予約を防止しながら登録します。
          </p>
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

      <section className="mb-8 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-lg font-medium">新規予約を登録</h2>
        <form action={createAppointment} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="returnTo" value={returnTo} />
          <label className="text-sm text-gray-700">
            スタッフ
            <select
              name="staffId"
              required
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">選択してください</option>
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
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              defaultValue={preselectedCustomerId}
            >
              <option value="">未選択</option>
              {customerList.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.lastName} {customer.firstName}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-gray-700">
            メニュー（任意）
            <select
              name="menuId"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              defaultValue=""
            >
              <option value="">未選択</option>
              {menuList.map((menu) => (
                <option key={menu.id} value={menu.id}>
                  {menu.name} ({menu.durationMinutes}分)
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-gray-700">
            開始時刻
            <input
              type="datetime-local"
              name="startAt"
              defaultValue={defaultStartAt}
              required
              step={300}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <span className="mt-1 block text-xs text-gray-500">5分単位で入力してください。</span>
          </label>

          <label className="text-sm text-gray-700">
            所要時間（分）
            <input
              type="number"
              name="durationMinutes"
              min={5}
              max={600}
              step={5}
              defaultValue={60}
              required
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <span className="mt-1 block text-xs text-gray-500">5〜600分（5分単位）</span>
          </label>

          <label className="text-sm text-gray-700 sm:col-span-2">
            メモ（任意）
            <textarea
              name="notes"
              rows={3}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          <SubmitButton
            className="sm:col-span-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            pendingText="登録中..."
          >
            予約を登録
          </SubmitButton>
        </form>
      </section>

      <section className="mb-8 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-lg font-medium">検索・フィルター</h2>
        <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <input type="hidden" name="view" value={view} />
          <input type="hidden" name="date" value={currentDateParam} />
          {preselectedCustomerId && (
            <input type="hidden" name="customerId" value={preselectedCustomerId} />
          )}
          <input
            name="q"
            defaultValue={q}
            placeholder="顧客/スタッフ/メニュー/メモ"
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
            name="status"
            defaultValue={selectedStatus}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">全ステータス</option>
            <option value="BOOKED">予約中</option>
            <option value="COMPLETED">来店完了</option>
            <option value="CANCELLED">キャンセル</option>
          </select>
          <select
            name="sort"
            defaultValue={selectedSort}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="start_asc">日時: 古い順</option>
            <option value="start_desc">日時: 新しい順</option>
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
      </section>

      <section className="mb-8 rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium">今日の予約ボード</h2>
            <p className="text-sm text-gray-600">
              当日の進行管理と会計漏れ防止
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-md border border-gray-300 px-2 py-1 text-gray-700">
              予約中 {todayBookedCount}
            </span>
            <span className="rounded-md border border-indigo-300 px-2 py-1 text-indigo-700">
              来店完了 {todayCompletedCount}
            </span>
            <span className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-amber-800">
              未会計 {todayUnpaidCompletedCount}
            </span>
          </div>
        </div>
        <div className="space-y-2">
          {todayAppointments.length === 0 ? (
            <p className="text-sm text-gray-500">本日の予約はありません。</p>
          ) : (
            todayAppointments.map((appointment) => (
              <div
                key={appointment.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
              >
                <div>
                  <div className="font-medium text-gray-900">
                    {new Intl.DateTimeFormat("ja-JP", {
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(appointment.startAt)}
                    {" - "}
                    {new Intl.DateTimeFormat("ja-JP", {
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(appointment.endAt)}
                    {" / "}
                    {appointment.staff.name}
                  </div>
                  <div className="text-gray-700">
                    {appointment.customer ? (
                      <Link
                        href={`/customers/${appointment.customer.id}`}
                        className="text-emerald-700 hover:underline"
                      >
                        {appointment.customer.lastName} {appointment.customer.firstName}
                      </Link>
                    ) : (
                      "顧客未指定"
                    )}
                    {" / "}
                    {appointment.menu?.name ?? "メニュー未指定"}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {appointment.status === "BOOKED" ? (
                    <>
                      <form action={completeAppointment}>
                        <input type="hidden" name="appointmentId" value={appointment.id} />
                        <input type="hidden" name="returnTo" value={returnTo} />
                        <SubmitButton
                          className="rounded-md border border-indigo-300 px-2 py-1 text-xs text-indigo-700 hover:bg-indigo-50"
                          pendingText="処理中..."
                        >
                          来店完了
                        </SubmitButton>
                      </form>
                      <form action={cancelAppointment}>
                        <input type="hidden" name="appointmentId" value={appointment.id} />
                        <input type="hidden" name="returnTo" value={returnTo} />
                        <ConfirmSubmitButton
                          className="rounded-md border border-red-400 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                          pendingText="処理中..."
                          confirmMessage="この予約をキャンセルします。よろしいですか？"
                        >
                          キャンセル
                        </ConfirmSubmitButton>
                      </form>
                    </>
                  ) : appointment.status === "COMPLETED" ? (
                    appointment.payment ? (
                      <span className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
                        会計済み
                      </span>
                    ) : (
                      <Link
                        href={`/payments?appointmentId=${appointment.id}`}
                        className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800 hover:bg-amber-100"
                      >
                        会計登録
                      </Link>
                    )
                  ) : (
                    <span className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700">
                      キャンセル済み
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="mb-8 rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium">スタッフ別カレンダー</h2>
            <p className="text-sm text-gray-600">
              {view === "week" ? "週表示" : "日表示"} /{" "}
              {new Intl.DateTimeFormat("ja-JP", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
              }).format(calendarStart)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/appointments?view=${view}&date=${previousDate}`}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              前へ
            </Link>
            <Link
              href={`/appointments?view=${view}&date=${toDateParam(new Date())}`}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              今日
            </Link>
            <Link
              href={`/appointments?view=${view}&date=${nextDate}`}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              次へ
            </Link>
            <Link
              href={`/appointments?view=day&date=${currentDateParam}`}
              className={`rounded-md px-3 py-1.5 text-sm ${
                view === "day"
                  ? "bg-emerald-600 text-white"
                  : "border border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              日
            </Link>
            <Link
              href={`/appointments?view=week&date=${currentDateParam}`}
              className={`rounded-md px-3 py-1.5 text-sm ${
                view === "week"
                  ? "bg-emerald-600 text-white"
                  : "border border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              週
            </Link>
          </div>
        </div>
        <div className="space-y-4">
          {staffList.map((staff) => {
            const rows = calendarAppointments.filter(
              (appointment) => appointment.staff.id === staff.id,
            );
            return (
              <div
                key={staff.id}
                className="rounded-lg border border-gray-200 bg-gray-50 p-3"
              >
                <h3 className="mb-2 text-sm font-semibold text-gray-800">
                  {staff.name}
                </h3>
                {rows.length === 0 ? (
                  <p className="text-sm text-gray-500">予約なし</p>
                ) : (
                  <div className="space-y-2">
                    {rows.map((appointment) => (
                      <div
                        key={appointment.id}
                        className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
                      >
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
                          顧客:{" "}
                          {appointment.customer
                            ? `${appointment.customer.lastName} ${appointment.customer.firstName}`
                            : "-"}
                          {" / "}メニュー: {appointment.menu?.name ?? "-"}
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          {appointment.payment ? (
                            <span className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
                              会計済み
                            </span>
                          ) : (
                            <Link
                              href={`/payments?appointmentId=${appointment.id}`}
                              className="rounded-md border border-emerald-300 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50"
                            >
                              会計登録
                            </Link>
                          )}
                          <Link
                            href={`/appointments/${appointment.id}/edit`}
                            className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                          >
                            編集
                          </Link>
                          <form action={cancelAppointment}>
                            <input
                              type="hidden"
                              name="appointmentId"
                              value={appointment.id}
                            />
                            <input type="hidden" name="returnTo" value={returnTo} />
                            <ConfirmSubmitButton
                              className="rounded-md border border-red-400 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                              pendingText="処理中..."
                              confirmMessage="この予約をキャンセルします。よろしいですか？"
                            >
                              キャンセル
                            </ConfirmSubmitButton>
                          </form>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-medium">予約一覧（最大300件）</h2>
          <span className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700">
            表示件数 {appointments.length}
          </span>
        </div>
        <FilterSummary
          items={[
            { key: "q", value: q },
            { key: "staff", value: selectedStaffId },
            { key: "status", value: selectedStatus },
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
                <th className="p-2 font-medium">スタッフ</th>
                <th className="p-2 font-medium">顧客</th>
                <th className="p-2 font-medium">メニュー</th>
                <th className="p-2 font-medium">メモ</th>
                <th className="p-2 font-medium">ステータス</th>
                <th className="p-2 font-medium">会計</th>
                <th className="p-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((appointment) => (
                <tr key={appointment.id} className="border-b border-gray-100">
                  <td className="p-2">
                    {new Intl.DateTimeFormat("ja-JP", {
                      year: "numeric",
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
                  </td>
                  <td className="p-2">{appointment.staff.name}</td>
                  <td className="p-2">
                    {appointment.customer
                      ? `${appointment.customer.lastName} ${appointment.customer.firstName}`
                      : "-"}
                  </td>
                  <td className="p-2">{appointment.menu?.name ?? "-"}</td>
                  <td className="p-2">{appointment.notes ?? "-"}</td>
                  <td className="p-2">
                    {appointment.status === "BOOKED"
                      ? "予約中"
                      : appointment.status === "COMPLETED"
                        ? "来店完了"
                        : "キャンセル"}
                  </td>
                  <td className="p-2">
                    {appointment.payment ? (
                      <span className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
                        会計済み
                      </span>
                    ) : (
                      <Link
                        href={`/payments?appointmentId=${appointment.id}`}
                        className="rounded-md border border-emerald-300 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50"
                      >
                        会計登録
                      </Link>
                    )}
                  </td>
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      {appointment.status === "BOOKED" && (
                        <form action={completeAppointment}>
                          <input
                            type="hidden"
                            name="appointmentId"
                            value={appointment.id}
                          />
                          <input type="hidden" name="returnTo" value={returnTo} />
                          <SubmitButton
                            className="rounded-md border border-indigo-300 px-2 py-1 text-xs text-indigo-700 hover:bg-indigo-50"
                            pendingText="処理中..."
                          >
                            来店完了
                          </SubmitButton>
                        </form>
                      )}
                      <Link
                        href={`/appointments/${appointment.id}/edit`}
                        className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                      >
                        編集
                      </Link>
                      {appointment.status === "BOOKED" && (
                        <form action={cancelAppointment}>
                          <input
                            type="hidden"
                            name="appointmentId"
                            value={appointment.id}
                          />
                          <input type="hidden" name="returnTo" value={returnTo} />
                          <ConfirmSubmitButton
                            className="rounded-md border border-red-400 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                            pendingText="処理中..."
                            confirmMessage="この予約をキャンセルします。よろしいですか？"
                          >
                            キャンセル
                          </ConfirmSubmitButton>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {appointments.length === 0 && (
                <tr>
                  <td className="p-3 text-center text-sm text-gray-500" colSpan={8}>
                    条件に一致する予約はありません。
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
