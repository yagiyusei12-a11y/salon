import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { createCustomer, updateCustomerTags } from "@/app/customers/actions";
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
} from "@/lib/list-query";
import { prisma } from "@/lib/prisma";

function renderTagBadge(tag: string) {
  if (tag === "VIP") {
    return "rounded bg-purple-100 px-1.5 py-0.5 text-xs text-purple-700";
  }
  if (tag === "CAUTION") {
    return "rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700";
  }
  return "rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700";
}

type Props = {
  searchParams?: Promise<{
    q?: string;
    tag?: string;
    sort?: string;
    result?: string;
    message?: string;
  }>;
};

export default async function CustomersPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.tenantId) {
    redirect("/login");
  }

  const resolvedParams = (await searchParams) ?? {};
  const q = (resolvedParams.q ?? "").trim();
  const selectedTag = (resolvedParams.tag ?? "").trim().toUpperCase();
  const selectedSort = (resolvedParams.sort ?? "created_desc").trim();
  const result = (resolvedParams.result ?? "").trim();
  const message = (resolvedParams.message ?? "").trim();
  const returnToQuery = new URLSearchParams();
  setIfNonEmpty(returnToQuery, "q", q);
  setIfNonEmpty(returnToQuery, "tag", selectedTag);
  setSortUnlessDefault(returnToQuery, "sort", selectedSort, "created_desc");
  const returnTo = pathnameWithSearch("/customers", returnToQuery);
  const exportHref = exportApiHref("customers", returnToQuery);

  const where = {
    tenantId: session.user.tenantId,
    ...(selectedTag && ["VIP", "CAUTION", "NEW"].includes(selectedTag)
      ? { tags: { contains: selectedTag } }
      : {}),
    ...(q
      ? {
          OR: [
            { lastName: { contains: q } },
            { firstName: { contains: q } },
            { email: { contains: q } },
            { phone: { contains: q } },
            { notes: { contains: q } },
          ],
        }
      : {}),
  };

  const customers = await prisma.customer.findMany({
    where,
    orderBy:
      selectedSort === "created_asc"
        ? { createdAt: "asc" }
        : selectedSort === "name_asc"
          ? [{ lastName: "asc" }, { firstName: "asc" }]
          : { createdAt: "desc" },
    take: 200,
  });

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">顧客管理</h1>
          <p className="text-sm text-gray-600">顧客の新規登録と一覧確認</p>
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
        <h2 className="mb-4 text-lg font-medium">検索・タグフィルター</h2>
        <form method="get" className="grid gap-3 sm:grid-cols-4">
          <input
            name="q"
            defaultValue={q}
            placeholder="氏名/電話/メール/メモ"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm sm:col-span-2"
          />
          <select
            name="tag"
            defaultValue={selectedTag}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">全タグ</option>
            <option value="VIP">VIP</option>
            <option value="CAUTION">要注意</option>
            <option value="NEW">新規</option>
          </select>
          <select
            name="sort"
            defaultValue={selectedSort}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="created_desc">作成日: 新しい順</option>
            <option value="created_asc">作成日: 古い順</option>
            <option value="name_asc">氏名順</option>
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
            href="/customers"
            className="rounded-md border border-gray-300 px-2 py-1 text-gray-700 hover:bg-gray-50"
          >
            条件をリセット
          </Link>
          <Link
            href="/customers?tag=VIP&sort=name_asc"
            className="rounded-md border border-purple-300 bg-purple-50 px-2 py-1 text-purple-700 hover:bg-purple-100"
          >
            VIP優先表示
          </Link>
        </div>
      </section>

      <section className="mb-8 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-lg font-medium">新規顧客を追加</h2>
        <form action={createCustomer} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="returnTo" value={returnTo} />
          <input
            name="lastName"
            placeholder="姓（例: 山田）"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            required
          />
          <input
            name="firstName"
            placeholder="名（例: 花子）"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            required
          />
          <input
            name="phone"
            placeholder="電話番号"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            name="email"
            type="email"
            placeholder="メールアドレス"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <textarea
            name="notes"
            placeholder="メモ"
            className="sm:col-span-2 rounded-md border border-gray-300 px-3 py-2 text-sm"
            rows={3}
          />
          <input
            name="tags"
            placeholder="タグ (VIP,CAUTION,NEW をカンマ区切り)"
            className="sm:col-span-2 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <SubmitButton
            className="sm:col-span-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            pendingText="登録中..."
          >
            登録
          </SubmitButton>
        </form>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-medium">顧客一覧（最大200件）</h2>
          <span className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700">
            表示件数 {customers.length}
          </span>
        </div>
        <FilterSummary
          items={[
            { key: "q", value: q },
            { key: "tag", value: selectedTag },
            { key: "sort", value: selectedSort },
          ]}
        />
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="p-2 font-medium">氏名</th>
                <th className="p-2 font-medium">電話番号</th>
                <th className="p-2 font-medium">メール</th>
                <th className="p-2 font-medium">タグ</th>
                <th className="p-2 font-medium">作成日</th>
                <th className="p-2 font-medium">タグ編集</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer: (typeof customers)[number]) => (
                <tr key={customer.id} className="border-b border-gray-100">
                  <td className="p-2">
                    <Link
                      href={`/customers/${customer.id}`}
                      className="text-emerald-700 hover:underline"
                    >
                      {customer.lastName} {customer.firstName}
                    </Link>
                  </td>
                  <td className="p-2">{customer.phone ?? "-"}</td>
                  <td className="p-2">{customer.email ?? "-"}</td>
                  <td className="p-2">
                    <div className="flex flex-wrap gap-1">
                      {(customer.tags ?? "")
                        .split(",")
                        .filter(Boolean)
                        .map((tag: string) => (
                          <span key={tag} className={renderTagBadge(tag)}>
                            {tag === "VIP"
                              ? "VIP"
                              : tag === "CAUTION"
                                ? "要注意"
                                : "新規"}
                          </span>
                        ))}
                    </div>
                  </td>
                  <td className="p-2">
                    {new Intl.DateTimeFormat("ja-JP", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                    }).format(customer.createdAt)}
                  </td>
                  <td className="p-2">
                    <form action={updateCustomerTags} className="flex gap-2">
                      <input type="hidden" name="customerId" value={customer.id} />
                      <input type="hidden" name="returnTo" value={returnTo} />
                      <input
                        name="tags"
                        defaultValue={customer.tags ?? ""}
                        placeholder="VIP,CAUTION,NEW"
                        className="w-40 rounded-md border border-gray-300 px-2 py-1 text-xs"
                      />
                      <SubmitButton
                        className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                        pendingText="保存中..."
                      >
                        保存
                      </SubmitButton>
                    </form>
                  </td>
                </tr>
              ))}
              {customers.length === 0 && (
                <tr>
                  <td className="p-3 text-center text-sm text-gray-500" colSpan={6}>
                    条件に一致する顧客はありません。
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
