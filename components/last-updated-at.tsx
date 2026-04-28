type LastUpdatedAtProps = {
  className?: string;
};

export function LastUpdatedAt({ className = "text-xs text-gray-500" }: LastUpdatedAtProps) {
  const label = new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date());

  return <p className={className}>最終更新: {label}</p>;
}
