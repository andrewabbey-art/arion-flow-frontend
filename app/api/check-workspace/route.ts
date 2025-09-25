// ✅ Added
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic"; // ✅ Added
export const runtime = "nodejs";        // ✅ Added

const TIMEOUT_MS = 5_000;

type CheckResponse = {
  ok: boolean;
  status: number;
};

async function probeUrl(url: URL, method: "HEAD" | "GET") {
  const controller = new AbortController();
  // ✅ Added: Abort the probe if it hangs longer than TIMEOUT_MS so the UI isn't stuck waiting.
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    return await fetch(url, {
      method,
      // ✅ Added: Follow redirects and avoid caching so we always see the live status.
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawUrl = searchParams.get("url") ?? searchParams.get("workspaceUrl");

  if (!rawUrl) {
    return NextResponse.json<CheckResponse>(
      { ok: false, status: 0 },
      { status: 400 }
    );
  }

  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    return NextResponse.json<CheckResponse>(
      { ok: false, status: 0 },
      { status: 400 }
    );
  }

  try {
    let response = await probeUrl(target, "HEAD");

    if (response.status === 405) {
      // ✅ Added: Some services reject HEAD; retry with GET so we still surface their status code.
      response = await probeUrl(target, "GET");
    }

    const payload: CheckResponse = {
      ok: response.status >= 200 && response.status < 400,
      status: response.status,
    };

    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    const status =
      error instanceof DOMException && error.name === "AbortError" ? 504 : 502;
    // ✅ Added: Network failures/timeouts mean we couldn't reach the workspace at all.
    return NextResponse.json<CheckResponse>(
      { ok: false, status: 0 },
      { status }
    );
  }
}
