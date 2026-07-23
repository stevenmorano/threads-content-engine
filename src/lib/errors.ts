export function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "An unexpected error occurred.";
}

export function messageUrl(
  path: string,
  kind: "success" | "error",
  message: string,
) {
  const params = new URLSearchParams({ [kind]: message });
  return `${path}?${params.toString()}`;
}
