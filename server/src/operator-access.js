export function parseOperatorIds(value = "") {
  return new Set(
    value
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  );
}

export function isOperator(user, allowedIds, production) {
  if (!user?.userId) return false;
  return !production || allowedIds.has(user.userId);
}
