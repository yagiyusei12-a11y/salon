"use client";

import { FormEvent, useState } from "react";

export function BackupImportForm() {
  const [jsonText, setJsonText] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const payload = JSON.parse(jsonText);
      const response = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Import failed");
      }

      setMessage("復元が完了しました。画面を再読み込みしてください。");
      setJsonText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "復元に失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <textarea
        value={jsonText}
        onChange={(event) => setJsonText(event.target.value)}
        rows={10}
        placeholder="バックアップJSONを貼り付け"
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        required
      />
      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
      >
        {loading ? "復元中..." : "この内容で復元（全置換）"}
      </button>
      {message && <p className="text-sm text-emerald-700">{message}</p>}
      {error && <p className="text-sm text-red-700">{error}</p>}
    </form>
  );
}
