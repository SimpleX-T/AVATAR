export async function readApiResponse(response) {
  const data =
    response.status === 204 || response.status === 205
      ? null
      : await response.json();
  if (!response.ok) {
    throw new Error(data?.error || "Could not complete the request. Please retry.");
  }
  return data;
}
