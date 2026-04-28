import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { FilterSummary } from "@/components/filter-summary";
import { LastUpdatedAt } from "@/components/last-updated-at";
import { prisma } from "@/lib/prisma";

type Props = {
  searchParams?: Promise<{
    q?: string;
    action?: string;
    actor?: string;
  }>;
};

export default async function AuditLogsPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    redirect("/login");
  }
  if (session.user.role !== "OWNER") {
    redirect("/");
  }

  const resolvedParams = (await searchParams) ?? {};
  const q = (resolvedParams.q ?? "").trim();
  const actionFilter = (resolvedParams.action ?? "").trim();
  const actorFilter = (resolvedParams.actor ?? "").trim();
  const tenantId = session.user.tenantId;

  const where = {
    tenantId,
    ...(actionFilter ? { action: { contains: actionFilter } } : {}),
    ...(actorFilter
      ? {
          actor: {
            is: {
              OR: [
                { name: { contains: actorFilter } },
                { email: { contains: actorFilter } },
              ],
            },
          },
        }
      : {}),
    ...(q
      ? {
          OR: [
            { action: { contains: q } },
            { targetType: { contains: q } },
            { targetId: { contains: q } },
            { detail: { contains: q } },
          ],
        }
      : {}),
  };

  const logs = await prisma.auditLog.findMany({
    where,
    include: {
      actor: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">監査ログ</h1>
          <p className="text-sm text-gray-600">主要操作の変更履歴を確認できます。</p>
          <LastUpdatedAt />
        </div>
        <Link href="/" className="text-sm text-emerald-700 hover:underline">
          ダッシュボードへ戻る
        </Link>
      </header>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-lg font-medium">絞り込み</h2>
        <form method="get" className="grid gap-3 sm:grid-cols-3">
          <input
            name="q"
            defaultValue={q}
            placeholder="操作/対象/詳細"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            name="action"
            defaultValue={actionFilter}
            placeholder="action (例: backup.import)"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            name="actor"
            defaultValue={actorFilter}
            placeholder="実行者 (氏名/メール)"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 sm:col-span-3"
          >
            適用
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-medium">ログ一覧（最新200件）</h2>
          <span className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700">
            表示件数 {logs.length}
          </span>
        </div>
        <FilterSummary
          items={[
            { key: "q", value: q },
            { key: "action", value: actionFilter },
            { key: "actor", value: actorFilter },
          ]}
        />
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="p-2 font-medium">日時</th>
                <th className="p-2 font-medium">実行者</th>
                <th className="p-2 font-medium">操作</th>
                <th className="p-2 font-medium">対象</th>
                <th className="p-2 font-medium">詳細</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-gray-100">
                  <td className="p-2">
                    {new Intl.DateTimeFormat("ja-JP", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    }).format(log.createdAt)}
                  </td>
                  <td className="p-2">
                    {log.actor ? `${log.actor.name} (${log.actor.email})` : "system"}
                  </td>
                  <td className="p-2">{log.action}</td>
                  <td className="p-2">
                    {log.targetType}
                    {log.targetId ? ` / ${log.targetId}` : ""}
                  </td>
                  <td className="p-2">{log.detail ?? "-"}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td className="p-3 text-center text-sm text-gray-500" colSpan={5}>
                    条件に一致するログはありません。
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
