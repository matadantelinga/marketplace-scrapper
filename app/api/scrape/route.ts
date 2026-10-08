import { scrapeStore, type ScrapeOptions } from "@/lib/scraper";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const body = (await req.json()) as ScrapeOptions;
  try {
    new URL(body.url);
  } catch {
    return Response.json({ error: "URL tidak valid" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: unknown) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        await scrapeStore(body, emit);
      } catch (err: any) {
        emit({ type: "error", message: err?.message ?? "Terjadi kesalahan" });
        emit({ type: "done", total: 0 });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
