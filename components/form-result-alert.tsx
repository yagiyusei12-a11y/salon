type FormResultAlertProps = {
  status?: string;
  message?: string;
};

export function FormResultAlert({ status, message }: FormResultAlertProps) {
  if (!status || !message) return null;

  const isSuccess = status === "success";
  const hint =
    !isSuccess && message.includes("ログイン")
      ? "ログイン状態を確認し、ページを再読み込みしてください。"
      : !isSuccess && message.includes("見つかりません")
        ? "対象データが更新・削除されていないか確認し、一覧を再読み込みしてください。"
        : !isSuccess
          ? "入力値を確認して再実行してください。解消しない場合は時刻と操作内容を控えて管理者へ共有してください。"
          : null;

  return (
    <div
      className={`mb-4 rounded-md border px-3 py-2 text-sm ${
        isSuccess
          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
          : "border-red-300 bg-red-50 text-red-800"
      }`}
    >
      <p>{message}</p>
      {hint && <p className="mt-1 text-xs opacity-90">対処ヒント: {hint}</p>}
    </div>
  );
}
