import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { pathnameWithSearch } from "@/lib/list-query";
import { getInAppNotifications } from "@/lib/notifications";
import { FilterSummary } from "@/components/filter-summary";
import { LastUpdatedAt } from "@/components/last-updated-at";

type Props = {
  searchParams?: Promise<{
    hide?: string;
    only?: string;
  }>;
};

export default async function NotificationsPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    redirect("/login");
  }

  const resolvedSearchParams = (await searchParams) ?? {};
  const hiddenIds = new Set(
    String(resolvedSearchParams.hide ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  );
  const only = String(resolvedSearchParams.only ?? "").trim();

  const allNotifications = await getInAppNotifications(session.user.tenantId);
  const filteredByLevel =
    only === "warning"
      ? allNotifications.filter((item) => item.level === "warning")
      : allNotifications;
  const notifications = filteredByLevel.filter((item) => !hiddenIds.has(item.id));
  const warningCount = allNotifications.filter((item) => item.level === "warning").length;
  const infoCount = allNotifications.filter((item) => item.level === "info").length;

  const createHideHref = (id: string) => {
    const nextHidden = new Set(hiddenIds);
    nextHidden.add(id);
    const params = new URLSearchParams();
    if (only) params.set("only", only);
    if (nextHidden.size > 0) params.set("hide", Array.from(nextHidden).join(","));
    return pathnameWithSearch("/notifications", params);
  };

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">通知センター</h1>
          <p className="text-sm text-gray-600">運用上のリマインドを表示します。</p>
          <LastUpdatedAt />
        </div>
        <Link href="/" className="text-sm text-emerald-700 hover:underline">
          ダッシュボードへ戻る
        </Link>
      </header>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-medium">通知一覧</h2>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-amber-800">
              重要 {warningCount}
            </span>
            <span className="rounded-md border border-blue-300 bg-blue-50 px-2 py-1 text-blue-800">
              通常 {infoCount}
            </span>
            <span className="rounded-md border border-gray-300 px-2 py-1 text-gray-700">
              表示 {notifications.length}
            </span>
          </div>
        </div>
        <FilterSummary
          items={[
            { key: "only", value: only || "all" },
            { key: "hidden", value: String(hiddenIds.size) },
          ]}
        />
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
          <Link
            href="/notifications"
            className={`rounded-md border px-2 py-1 ${
              only === "" ? "border-emerald-400 text-emerald-700" : "border-gray-300 text-gray-700"
            }`}
          >
            すべて
          </Link>
          <Link
            href="/notifications?only=warning"
            className={`rounded-md border px-2 py-1 ${
              only === "warning"
                ? "border-amber-400 bg-amber-50 text-amber-800"
                : "border-gray-300 text-gray-700"
            }`}
          >
            重要のみ
          </Link>
          {hiddenIds.size > 0 && (
            <Link href={only ? `/notifications?only=${only}` : "/notifications"} className="underline">
              非表示をリセット
            </Link>
          )}
        </div>
        <div className="space-y-3">
          {notifications.length === 0 ? (
            <p className="text-sm text-gray-500">表示対象の通知はありません。</p>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className={`rounded-md border px-3 py-2 text-sm ${
                  notification.level === "warning"
                    ? "border-amber-300 bg-amber-50"
                    : "border-blue-300 bg-blue-50"
                }`}
              >
                <p className="font-medium">{notification.title}</p>
                <p className="text-gray-700">{notification.message}</p>
                <div className="mt-1 flex items-center gap-3">
                  <Link href={notification.href} className="inline-block underline">
                    対象画面へ移動
                  </Link>
                  <Link href={createHideHref(notification.id)} className="inline-block text-xs underline">
                    既読として非表示
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
