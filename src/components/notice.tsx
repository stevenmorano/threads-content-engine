import { AlertCircle, CheckCircle2 } from "lucide-react";

export function Notice({
  success,
  error,
}: {
  success?: string;
  error?: string;
}) {
  const message = error ?? success;
  if (!message) return null;

  return (
    <div className={`notice ${error ? "notice-error" : "notice-success"}`} role="status">
      {error ? <AlertCircle aria-hidden="true" size={18} /> : <CheckCircle2 aria-hidden="true" size={18} />}
      <span>{message}</span>
    </div>
  );
}
