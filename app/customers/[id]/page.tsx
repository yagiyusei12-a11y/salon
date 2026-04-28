import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { updateCustomerTags } from "@/app/customers/actions";
import { FormResultAlert } from "@/components/form-result-alert";
import { SubmitButton } from "@/components/submit-button";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ result?: string; message?: string }>;
};

export default async function CustomerDetailPage({ params, searchParams }: Props) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    redirect("/login");
  }

  const tenantId = session.user.tenantId;
  const { id } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const result = (resolvedSearchParams.result ?? "").trim();
  const message = (resolvedSearchParams.message ?? "").trim();

  const [customer, appointments, payments] = await Promise.all([
    prisma.customer.findFirst({
      where: { id, tenantId },
    }),
    prisma.appointment.findMany({
      where: { tenantId, customerId: id },
      include: {
        staff: { select: { name: true } },
        menu: { select: { name: true } },
      },
      orderBy: { startAt: "desc" },
      take: 20,
    }),
    prisma.payment.findMany({
      where: { tenantId, customerId: id },
      include: {
        staff: { select: { name: true } },
      },
      orderBy: { paidAt: "desc" },
      take: 20,
    }),
  ]);

  if (!customer) {
    notFound();
  }

  const totalSales = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const tags = (customer.tags ?? "").split(",").filter(Boolean);

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {customer.lastName} {customer.firstName}
          </h1>
          <p className="text-sm text-gray-600">顧客詳細</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/appointments?customerId=${customer.id}`}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            次回予約を作成
          </Link>
          <Link href="/customers" className="text-sm text-emerald-700 hover:underline">
            顧客一覧へ戻る
          </Link>
        </div>
      </header>
      <FormResultAlert status={result} message={message} />

      <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">電話番号</p>
          <p className="mt-1 text-sm font-medium">{customer.phone ?? "-"}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">メール</p>
          <p className="mt-1 text-sm font-medium">{customer.email ?? "-"}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">来店回数（予約）</p>
          <p className="mt-1 text-sm font-medium">{appointments.length} 回</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">累計売上</p>
          <p className="mt-1 text-sm font-medium">
            {totalSales.toLocaleString("ja-JP")} 円
          </p>
        </div>
      </section>

      <section className="mb-8 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-3 text-lg font-medium">タグ・メモ</h2>
        <form action={updateCustomerTags} className="mb-4 flex items-center gap-2">
          <input type="hidden" name="customerId" value={customer.id} />
          <input type="hidden" name="returnTo" value={`/customers/${customer.id}`} />
          <input
            name="tags"
            defaultValue={customer.tags ?? ""}
            placeholder="VIP,CAUTION,NEW"
            className="w-64 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <SubmitButton
            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            pendingText="保存中..."
          >
            タグ保存
          </SubmitButton>
        </form>
        <div className="mb-4 flex flex-wrap gap-2">
          {tags.length === 0 ? (
            <span className="text-sm text-gray-500">タグなし</span>
          ) : (
            tags.map((tag: string) => (
              <span
                key={tag}
                className={
                  tag === "VIP"
                    ? "rounded bg-purple-100 px-2 py-0.5 text-xs text-purple-700"
                    : tag === "CAUTION"
                      ? "rounded bg-red-100 px-2 py-0.5 text-xs text-red-700"
                      : "rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700"
                }
              >
                {tag === "VIP" ? "VIP" : tag === "CAUTION" ? "要注意" : "新規"}
              </span>
            ))
          )}
        </div>
        <p className="whitespace-pre-wrap text-sm text-gray-700">
          {customer.notes?.trim() || "メモはありません。"}
        </p>
      </section>

      <section className="mb-8 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-lg font-medium">来店履歴（最新20件）</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="p-2 font-medium">日時</th>
                <th className="p-2 font-medium">担当</th>
                <th className="p-2 font-medium">メニュー</th>
                <th className="p-2 font-medium">ステータス</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((appointment: (typeof appointments)[number]) => (
                <tr key={appointment.id} className="border-b border-gray-100">
                  <td className="p-2">
                    {new Intl.DateTimeFormat("ja-JP", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(appointment.startAt)}
                  </td>
                  <td className="p-2">{appointment.staff.name}</td>
                  <td className="p-2">{appointment.menu?.name ?? "-"}</td>
                  <td className="p-2">
                    {appointment.status === "BOOKED"
                      ? "予約中"
                      : appointment.status === "COMPLETED"
                        ? "来店完了"
                        : "キャンセル"}
                  </td>
                </tr>
              ))}
              {appointments.length === 0 && (
                <tr>
                  <td className="p-2 text-gray-500" colSpan={4}>
                    履歴がありません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-lg font-medium">会計履歴（最新20件）</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="p-2 font-medium">日時</th>
                <th className="p-2 font-medium">金額</th>
                <th className="p-2 font-medium">方法</th>
                <th className="p-2 font-medium">担当</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment: (typeof payments)[number]) => (
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
                </tr>
              ))}
              {payments.length === 0 && (
                <tr>
                  <td className="p-2 text-gray-500" colSpan={4}>
                    会計履歴がありません。
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
