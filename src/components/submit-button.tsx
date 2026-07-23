"use client";

import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";

type SubmitButtonProps = {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
};

export function SubmitButton({
  children,
  pendingText = "Working…",
  className = "button button-primary",
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button className={className} type="submit" disabled={pending}>
      {pending ? <LoaderCircle aria-hidden="true" className="spin" size={16} /> : null}
      {pending ? pendingText : children}
    </button>
  );
}
