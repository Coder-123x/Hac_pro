import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ className = "", type = "button", ...props }: ButtonProps) {
  return (
    <button
      className={`rounded-sm bg-[var(--cobalt)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--cobalt-dark)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cobalt)] disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      type={type}
      {...props}
    />
  );
}
