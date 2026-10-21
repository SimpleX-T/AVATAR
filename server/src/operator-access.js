export function parseOperatorIds(value = "") {
  return new Set(
    value
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  );
}

export function isOperator(user, allowedIds, production) {
  if (!user?.user_id) return false;
  return !production || allowedIds.has(user.user_id);
}
