import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { BackupImportForm } from "@/components/backup-import-form";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function BackupPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    redirect("/login");
  }
  if (session.user.role !== "OWNER") {
    redirect("/");
  }

  const backupLogs = await prisma.auditLog.findMany({
    where: {
      tenantId: session.user.tenantId,
      action: { in: ["backup.export", "backup.import"] },
    },
    include: {
      actor: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">バックアップ</h1>
          <Link href="/" className="text-sm text-emerald-700 hover:underline">
            ダッシュボードへ戻る
          </Link>
        </div>

        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-2 text-lg font-medium text-gray-900">エクスポート</h2>
          <p className="mb-4 text-sm text-gray-600">
            顧客・メニュー・予約・会計をJSONで保存します。
          </p>
          <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-amber-800">
            <li>ダウンロードしたJSONは、店舗データを丸ごと含みます。</li>
            <li>社外共有・チャット貼り付けは避け、安全な場所に保管してください。</li>
          </ul>
          <a
            href="/api/backup"
            className="inline-block rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            JSONをダウンロード
          </a>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-2 text-lg font-medium text-gray-900">復元（全置換）</h2>
          <p className="mb-4 text-sm text-red-700">
            復元時は現在の顧客・メニュー・予約・会計データを削除して置き換えます。
          </p>
          <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-red-700">
            <li>取り消しはできません。必ず最新のエクスポートを取得してから実行してください。</li>
            <li>復元直後は一覧画面を再読み込みし、件数を確認してください。</li>
          </ul>
          <BackupImportForm />
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900">バックアップ実行履歴</h2>
            <span className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700">
              最新 {backupLogs.length} 件
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left">
                  <th className="p-2 font-medium">日時</th>
                  <th className="p-2 font-medium">操作</th>
                  <th className="p-2 font-medium">実行者</th>
                  <th className="p-2 font-medium">詳細</th>
                </tr>
              </thead>
              <tbody>
                {backupLogs.map((log) => (
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
                      {log.action === "backup.export" ? "エクスポート" : "復元"}
                    </td>
                    <td className="p-2">
                      {log.actor ? `${log.actor.name} (${log.actor.email})` : "system"}
                    </td>
                    <td className="p-2">{log.detail ?? "-"}</td>
                  </tr>
                ))}
                {backupLogs.length === 0 && (
                  <tr>
                    <td className="p-3 text-center text-sm text-gray-500" colSpan={4}>
                      バックアップ履歴はまだありません。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
