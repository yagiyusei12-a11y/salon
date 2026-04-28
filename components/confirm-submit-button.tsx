"use client";

import { ButtonHTMLAttributes, MouseEvent, ReactNode } from "react";
import { useFormStatus } from "react-dom";

type ConfirmSubmitButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  pendingText?: string;
  confirmMessage?: string;
};

export function ConfirmSubmitButton({
  children,
  pendingText = "処理中...",
  confirmMessage = "この操作を実行しますか？",
  className,
  disabled,
  onClick,
  ...rest
}: ConfirmSubmitButtonProps) {
  const { pending } = useFormStatus();

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (!window.confirm(confirmMessage)) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

  return (
    <button
      type="submit"
      className={className}
      disabled={pending || disabled}
      onClick={handleClick}
      {...rest}
    >
      {pending ? pendingText : children}
    </button>
  );
}
