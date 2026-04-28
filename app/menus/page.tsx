import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { createMenu, deleteMenu, updateMenu } from "@/app/menus/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
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
    sort?: string;
    result?: string;
    message?: string;
  }>;
};

export default async function MenusPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    redirect("/login");
  }
  if (session.user.role !== "OWNER") {
    redirect("/");
  }
  const resolvedSearchParams = (await searchParams) ?? {};
  const q = (resolvedSearchParams.q ?? "").trim();
  const selectedSort = (resolvedSearchParams.sort ?? "created_desc").trim();
  const result = (resolvedSearchParams.result ?? "").trim();
  const message = (resolvedSearchParams.message ?? "").trim();
  const returnToQuery = new URLSearchParams();
  setIfNonEmpty(returnToQuery, "q", q);
  setSortUnlessDefault(returnToQuery, "sort", selectedSort, "created_desc");
  const returnTo = pathnameWithSearch("/menus", returnToQuery);

  const where = {
    tenantId: session.user.tenantId,
    ...(q ? { name: { contains: q } } : {}),
  };

  const menus = await prisma.serviceMenu.findMany({
    where,
    orderBy:
      selectedSort === "name_asc"
        ? { name: "asc" }
        : selectedSort === "name_desc"
          ? { name: "desc" }
          : { createdAt: "desc" },
    take: 100,
  });

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">メニュー管理</h1>
          <p className="text-sm text-gray-600">施術メニューの登録・更新・削除</p>
          <LastUpdatedAt />
        </div>
        <Link href="/" className="text-sm text-emerald-700 hover:underline">
          ダッシュボードへ戻る
        </Link>
      </header>
      <FormResultAlert status={result} message={message} />

      <section className="mb-8 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-lg font-medium">検索・並び替え</h2>
        <form method="get" className="grid gap-3 sm:grid-cols-3">
          <input
            name="q"
            defaultValue={q}
            placeholder="メニュー名"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm sm:col-span-2"
          />
          <select
            name="sort"
            defaultValue={selectedSort}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="created_desc">作成日: 新しい順</option>
            <option value="name_asc">名前: 昇順</option>
            <option value="name_desc">名前: 降順</option>
          </select>
          <button
            type="submit"
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 sm:col-span-3"
          >
            適用
          </button>
        </form>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-gray-500">クイック操作:</span>
          <Link
            href="/menus"
            className="rounded-md border border-gray-300 px-2 py-1 text-gray-700 hover:bg-gray-50"
          >
            条件をリセット
          </Link>
          <Link
            href="/menus?sort=name_asc"
            className="rounded-md border border-blue-300 bg-blue-50 px-2 py-1 text-blue-700 hover:bg-blue-100"
          >
            名前順
          </Link>
        </div>
      </section>

      <section className="mb-8 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-lg font-medium">新規メニュー</h2>
        <form action={createMenu} className="grid gap-3 sm:grid-cols-3">
          <input type="hidden" name="returnTo" value={returnTo} />
          <input
            name="name"
            placeholder="メニュー名"
            required
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            type="number"
            name="durationMinutes"
            min={5}
            step={5}
            defaultValue={60}
            required
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            type="number"
            name="price"
            min={0}
            step={100}
            placeholder="価格（円・任意）"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <SubmitButton
            className="sm:col-span-3 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            pendingText="追加中..."
          >
            メニューを追加
          </SubmitButton>
        </form>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-medium">メニュー一覧（最新100件）</h2>
          <span className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700">
            表示件数 {menus.length}
          </span>
        </div>
        <FilterSummary items={[{ key: "q", value: q }, { key: "sort", value: selectedSort }]} />
        <div className="space-y-4">
          {menus.length === 0 ? (
            <p className="text-sm text-gray-500">メニューがまだありません。</p>
          ) : (
            menus.map((menu: (typeof menus)[number]) => (
              <div key={menu.id} className="rounded-lg border border-gray-200 p-4">
                <form action={updateMenu} className="grid gap-3 sm:grid-cols-4">
                  <input type="hidden" name="menuId" value={menu.id} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <input
                    name="name"
                    defaultValue={menu.name}
                    required
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    name="durationMinutes"
                    min={5}
                    step={5}
                    required
                    defaultValue={menu.durationMinutes}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    name="price"
                    min={0}
                    step={100}
                    defaultValue={menu.price ?? ""}
                    placeholder="価格（任意）"
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                  <div className="flex items-center gap-2">
                    <SubmitButton
                      className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      pendingText="更新中..."
                    >
                      更新
                    </SubmitButton>
                    <ConfirmSubmitButton
                      type="submit"
                      formAction={deleteMenu}
                      className="rounded-md border border-red-400 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
                      pendingText="削除中..."
                      confirmMessage="このメニューを削除します。関連予約のメニュー設定は解除されます。続行しますか？"
                    >
                      削除
                    </ConfirmSubmitButton>
                  </div>
                </form>
              </div>
            ))
          )}
          {menus.length === 0 && (
            <p className="rounded-md border border-gray-200 p-3 text-sm text-gray-500">
              条件に一致するメニューはありません。
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
