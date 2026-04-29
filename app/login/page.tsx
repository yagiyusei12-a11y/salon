"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("メールアドレスまたはパスワードが正しくありません。");
      return;
    }

    router.push("/");
    router.refresh();
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-50/80 to-gray-50 px-4 py-10 sm:px-6">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-8">
        <header className="text-center sm:text-left">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            店舗管理システム
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">
            ログイン
          </h1>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-gray-600">
            店舗から案内された<strong className="font-medium text-gray-800">メールアドレス</strong>
            と<strong className="font-medium text-gray-800">パスワード</strong>を入力してください。
            ログイン後はダッシュボードから各メニューに進みます。
          </p>
        </header>

        <div className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm sm:p-8">
          <ol className="mb-6 space-y-3 text-sm text-gray-700">
            <li className="flex gap-3">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white"
                aria-hidden
              >
                1
              </span>
              <span>
                <span className="font-medium text-gray-900">メール</span>
                を入力（職場で共有されているログイン用アドレス）
              </span>
            </li>
            <li className="flex gap-3">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white"
                aria-hidden
              >
                2
              </span>
              <span>
                <span className="font-medium text-gray-900">パスワード</span>
                を入力し、「ログイン」を押す
              </span>
            </li>
          </ol>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="login-email"
                className="mb-1.5 block text-sm font-medium text-gray-800"
              >
                メールアドレス
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder="例: 名前@サロンのドメイン"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none ring-emerald-500/30 focus:border-emerald-500 focus:ring-4"
                required
              />
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="mb-1.5 block text-sm font-medium text-gray-800"
              >
                パスワード
              </label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                placeholder="半角英数など（店舗が指定したもの）"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none ring-emerald-500/30 focus:border-emerald-500 focus:ring-4"
                required
              />
            </div>

            {error && (
              <p
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
                role="alert"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
              disabled={loading}
            >
              {loading ? "確認しています…" : "ログインする"}
            </button>
          </form>

          <div className="mt-6 border-t border-gray-100 pt-6">
            <p className="text-xs font-semibold text-gray-500">ログイン後の目安</p>
            <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-gray-600">
              <li>
                <span className="font-medium text-gray-800">オーナー</span>
                ：「スタッフ管理」から、スタッフ用のログインアカウントを追加できます。
              </li>
              <li>
                <span className="font-medium text-gray-800">全員</span>
                ：ダッシュボードのカードから、顧客・予約・会計などよく使う画面へ進めます。
              </li>
            </ul>
          </div>

          <details className="mt-4 rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-2 text-xs text-gray-600">
            <summary className="cursor-pointer font-medium text-gray-800">
              初回セットアップ・デモ環境のとき
            </summary>
            <p className="mt-2 leading-relaxed">
              データベースに初期ユーザー（シード）を入れている場合は、プロジェクトの README に記載の
              デモ用メールでログインできます。本番公開前に必ずパスワードを変更し、不要なアカウントは
              無効化してください。
            </p>
          </details>

          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <p className="font-medium">セキュリティの注意</p>
            <p className="mt-1 leading-relaxed">
              初期・デモ用のパスワードのまま公開しないでください。オーナーは「スタッフ管理」で各自のパスワードを設定し直す運用を推奨します。
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-gray-500">
          ログイン情報をお持ちでない場合は、店舗の管理者にお問い合わせください。
        </p>
      </div>
    </main>
  );
}
