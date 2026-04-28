import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { updateAppointment } from "@/app/appointments/actions";
import { FormResultAlert } from "@/components/form-result-alert";
import { SubmitButton } from "@/components/submit-button";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function toDateTimeLocalValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ result?: string; message?: string }>;
};

export default async function EditAppointmentPage({ params, searchParams }: Props) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    redirect("/login");
  }

  const { id } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const result = (resolvedSearchParams.result ?? "").trim();
  const message = (resolvedSearchParams.message ?? "").trim();
  const tenantId = session.user.tenantId;

  const [appointment, staffList, customerList, menuList] = await Promise.all([
    prisma.appointment.findFirst({
      where: { id, tenantId, status: "BOOKED" },
      include: {
        customer: { select: { id: true } },
        menu: { select: { id: true } },
      },
    }),
    prisma.user.findMany({
      where: { tenantId },
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
  ]);

  if (!appointment) {
    notFound();
  }

  const durationMinutes = Math.round(
    (appointment.endAt.getTime() - appointment.startAt.getTime()) / 60000,
  );

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">予約編集</h1>
          <p className="text-sm text-gray-600">予約内容を更新します。</p>
        </div>
        <Link
          href="/appointments"
          className="text-sm text-emerald-700 hover:underline"
        >
          予約一覧へ戻る
        </Link>
      </header>
      <FormResultAlert status={result} message={message} />

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <form action={updateAppointment} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="appointmentId" value={appointment.id} />
          <input
            type="hidden"
            name="returnTo"
            value={`/appointments/${appointment.id}/edit`}
          />

          <label className="text-sm text-gray-700">
            スタッフ
            <select
              name="staffId"
              required
              defaultValue={appointment.staffId}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
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
              defaultValue={appointment.customer?.id ?? ""}
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

          <label className="text-sm text-gray-700">
            メニュー（任意）
            <select
              name="menuId"
              defaultValue={appointment.menu?.id ?? ""}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
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
              required
              defaultValue={toDateTimeLocalValue(appointment.startAt)}
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
              required
              defaultValue={durationMinutes}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <span className="mt-1 block text-xs text-gray-500">5〜600分（5分単位）</span>
          </label>

          <label className="text-sm text-gray-700 sm:col-span-2">
            メモ（任意）
            <textarea
              name="notes"
              rows={3}
              defaultValue={appointment.notes ?? ""}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          <SubmitButton
            className="sm:col-span-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            pendingText="更新中..."
          >
            予約を更新
          </SubmitButton>
        </form>
      </section>
    </main>
  );
}
