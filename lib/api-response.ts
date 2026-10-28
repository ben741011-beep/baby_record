export function apiError(error: unknown, fallback = "伺服器發生錯誤") {
  const message = error instanceof Error ? error.message : fallback;
  const status = error instanceof Error ? 400 : 500;
  return Response.json({ error: message }, { status });
}
