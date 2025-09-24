import { NextRequest, NextResponse } from "next/server";

// This route acts as a server-side proxy to check a workspace's status, avoiding CORS issues.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "URL parameter is missing" }, { status: 400 });
  }

  try {
    // ✅ Added: Use AbortController for a reasonable timeout.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5-second timeout

    const response = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal, // Pass the abort signal to the fetch request
    });

    clearTimeout(timeoutId);

    // ✅ Modified: Always return a consistent JSON object that the client expects.
    return NextResponse.json({ status: response.status });
  } catch (error) {
    console.error(`Error checking workspace URL ${url}:`, error);

    // ✅ Modified: Handle fetch errors (like timeouts) gracefully.
    return NextResponse.json({ status: 500, error: "Failed to connect to workspace" });
  }
}