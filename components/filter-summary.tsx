type FilterItem = {
  key: string;
  value: string;
};

type FilterSummaryProps = {
  items: FilterItem[];
  className?: string;
};

export function FilterSummary({ items, className = "mb-3 text-xs text-gray-500" }: FilterSummaryProps) {
  const summary = items
    .map((item) => `${item.key}=${item.value.trim() ? item.value : "-"}`)
    .join(" / ");

  return <p className={className}>条件: {summary}</p>;
}
