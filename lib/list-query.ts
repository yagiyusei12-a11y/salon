/** トリム後に値がある場合のみ search param をセット */
export function setIfNonEmpty(params: URLSearchParams, key: string, value: string): void {
  const v = value.trim();
  if (v) params.set(key, v);
}

/** 一覧の既定ソートと一致する場合はクエリから省略（URLを短く保つ） */
export function setSortUnlessDefault(
  params: URLSearchParams,
  key: string,
  value: string,
  defaultSort: string,
): void {
  const v = value.trim();
  if (!v || v === defaultSort) return;
  params.set(key, v);
}

export function cloneSearchParams(source: URLSearchParams): URLSearchParams {
  return new URLSearchParams(source.toString());
}

export function pathnameWithSearch(pathname: string, params: URLSearchParams): string {
  return params.size > 0 ? `${pathname}?${params.toString()}` : pathname;
}

/** 既存フィルターに日付範囲を上乗せ（今日/今週/今月プリセット用） */
export function withDateRange(base: URLSearchParams, from: string, to: string): URLSearchParams {
  const next = cloneSearchParams(base);
  next.set("from", from);
  next.set("to", to);
  return next;
}

/** 表示中フィルターを維持した CSV 出力 URL */
export function exportApiHref(kind: string, filterParams: URLSearchParams): string {
  const q = cloneSearchParams(filterParams);
  q.set("kind", kind);
  return `/api/exports?${q.toString()}`;
}
