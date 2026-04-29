import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { createStaff, updateStaff } from "@/app/staff/actions";
import { FilterSummary } from "@/components/filter-summary";
import { FormResultAlert } from "@/components/form-result-alert";
import { LastUpdatedAt } from "@/components/last-updated-at";
import { SubmitButton } from "@/components/submit-button";
import { authOptions } from "@/lib/auth";
import { pathnameWithSearch, setIfNonEmpty, setSortUnlessDefault } from "@/lib/list-query";
import { prisma } from "@/lib/prisma";

type Props = {
  searchParams?: Promise<{
    q?: string;
    status?: string;
    sort?: string;
    result?: string;
    message?: string;
  }>;
};

export default async function StaffPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    redirect("/login");
  }
  if (session.user.role !== "OWNER") {
    redirect("/");
  }
  const resolvedSearchParams = (await searchParams) ?? {};
  const q = (resolvedSearchParams.q ?? "").trim();
  const statusFilter = (resolvedSearchParams.status ?? "").trim();
  const selectedSort = (resolvedSearchParams.sort ?? "role_name_asc").trim();
  const result = (resolvedSearchParams.result ?? "").trim();
  const message = (resolvedSearchParams.message ?? "").trim();
  const returnToQuery = new URLSearchParams();
  setIfNonEmpty(returnToQuery, "q", q);
  setIfNonEmpty(returnToQuery, "status", statusFilter);
  setSortUnlessDefault(returnToQuery, "sort", selectedSort, "role_name_asc");
  const returnTo = pathnameWithSearch("/staff", returnToQuery);

  const where = {
    tenantId: session.user.tenantId,
    ...(statusFilter === "active"
      ? { isActive: true }
      : statusFilter === "inactive"
        ? { isActive: false }
        : {}),
    ...(q
      ? {
          OR: [{ name: { contains: q } }, { email: { contains: q } }],
        }
      : {}),
  };

  const staffUsers = await prisma.user.findMany({
    where,
    orderBy:
      selectedSort === "name_asc"
        ? [{ name: "asc" }]
        : selectedSort === "name_desc"
          ? [{ name: "desc" }]
          : [{ role: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">スタッフ管理</h1>
          <p className="text-sm text-gray-600">
            OWNERがスタッフ追加と権限変更を行います。
          </p>
          <LastUpdatedAt />
        </div>
        <Link href="/" className="text-sm text-emerald-700 hover:underline">
          ダッシュボードへ戻る
        </Link>
      </header>
      <FormResultAlert status={result} message={message} />

      <section className="mb-8 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-lg font-medium">検索・並び替え</h2>
        <form method="get" className="grid gap-3 sm:grid-cols-4">
          <input
            name="q"
            defaultValue={q}
            placeholder="氏名/メール"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm sm:col-span-2"
          />
          <select
            name="status"
            defaultValue={statusFilter}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">全状態</option>
            <option value="active">有効</option>
            <option value="inactive">無効</option>
          </select>
          <select
            name="sort"
            defaultValue={selectedSort}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="role_name_asc">ロール順/氏名順</option>
            <option value="name_asc">氏名: 昇順</option>
            <option value="name_desc">氏名: 降順</option>
          </select>
          <button
            type="submit"
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 sm:col-span-4"
          >
            適用
          </button>
        </form>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-gray-500">クイック操作:</span>
          <Link
            href="/staff"
            className="rounded-md border border-gray-300 px-2 py-1 text-gray-700 hover:bg-gray-50"
          >
            条件をリセット
          </Link>
          <Link
            href="/staff?status=active&sort=name_asc"
            className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-emerald-700 hover:bg-emerald-100"
          >
            有効スタッフ順
          </Link>
        </div>
      </section>

      <section className="mb-8 rounded-xl border border-emerald-100 bg-emerald-50/50 p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-900">ログイン用アカウントを追加</h2>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">
          ここで登録した<strong className="font-medium text-gray-800">メールアドレスとパスワード</strong>
          が、そのままログイン画面で使えます。スタッフ本人に初期パスワードを伝え、
          初回ログイン後に変更してもらう運用を推奨します。
        </p>
        <form action={createStaff} className="mt-5 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="returnTo" value={returnTo} />
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-700">表示名（氏名）</label>
            <input
              name="name"
              placeholder="例: 山田 花子"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">ログインID（メール）</label>
            <input
              name="email"
              type="email"
              placeholder="例: yamada@salon.jp"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">初期パスワード</label>
            <input
              name="password"
              type="password"
              placeholder="8文字以上"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-700">権限</label>
            <select
              name="role"
              defaultValue="STAFF"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm sm:max-w-xs"
            >
              <option value="STAFF">スタッフ（日々の受付・会計など）</option>
              <option value="OWNER">オーナー（メニュー・スタッフ・ログ・バックアップも可）</option>
            </select>
          </div>
          <SubmitButton
            className="sm:col-span-2 rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
            pendingText="追加中..."
          >
            この内容でアカウントを追加
          </SubmitButton>
        </form>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-medium">スタッフ一覧</h2>
          <span className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700">
            表示件数 {staffUsers.length}
          </span>
        </div>
        <FilterSummary
          items={[
            { key: "q", value: q },
            { key: "status", value: statusFilter },
            { key: "sort", value: selectedSort },
          ]}
        />
        <div className="space-y-3">
          {staffUsers.map((user: (typeof staffUsers)[number]) => (
            <form
              key={user.id}
              action={updateStaff}
              className="grid gap-3 rounded-lg border border-gray-200 p-3 sm:grid-cols-5"
            >
              <input type="hidden" name="userId" value={user.id} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <div className="sm:col-span-2">
                <p className="text-sm font-medium text-gray-900">{user.name}</p>
                <p className="text-xs text-gray-600">{user.email}</p>
                <p className="text-xs text-gray-500">
                  作成:{" "}
                  {new Intl.DateTimeFormat("ja-JP", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                  }).format(user.createdAt)}
                </p>
              </div>
              <select
                name="role"
                defaultValue={user.role}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="STAFF">STAFF</option>
                <option value="OWNER">OWNER</option>
              </select>
              <select
                name="isActive"
                defaultValue={user.isActive ? "true" : "false"}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="true">有効</option>
                <option value="false">無効</option>
              </select>
              <SubmitButton
                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                pendingText="更新中..."
              >
                更新
              </SubmitButton>
            </form>
          ))}
          {staffUsers.length === 0 && (
            <p className="rounded-md border border-gray-200 p-3 text-sm text-gray-500">
              条件に一致するスタッフはありません。
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
