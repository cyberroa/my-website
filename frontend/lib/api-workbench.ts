import { ApiError, getApiBaseUrl } from "@/lib/api";

async function parseJsonSafe(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function apiFetchWithAuth<T>(
  path: string,
  accessToken: string,
  init?: RequestInit,
): Promise<T> {
  const url = `${getApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await parseJsonSafe(res);
    throw new ApiError(`API request failed (${res.status})`, res.status, body);
  }

  return (await res.json()) as T;
}

export async function apiUploadWithAuth<T>(
  path: string,
  accessToken: string,
  formData: FormData,
  query?: Record<string, string | boolean | number | undefined>,
): Promise<T> {
  const base = getApiBaseUrl();
  const u = new URL(path.startsWith("/") ? `${base}${path}` : `${base}/${path}`);
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v === undefined) return;
      u.searchParams.set(k, String(v));
    });
  }
  const res = await fetch(u.toString(), {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  });
  if (!res.ok) {
    const body = await parseJsonSafe(res);
    throw new ApiError(`API request failed (${res.status})`, res.status, body);
  }
  return (await res.json()) as T;
}
