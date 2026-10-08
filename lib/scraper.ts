import { chromium, type Page } from "playwright";

export type Product = {
  url: string;
  title: string;
  category: string;
  description: string;
  price: string;
  images: string[];
};

export type ScrapeOptions = {
  url: string;
  maxProducts?: number; // default 50
  maxScrolls?: number; // default 15
  linkSelector?: string; // opsional: CSS selector link produk, mis. "a.product-card"
  concurrency?: number; // default 3
  cdpUrl?: string; // mis. http://localhost:9222 (pakai Chrome asli yang sudah login)
};

export type ScrapeEvent =
  | { type: "status"; message: string }
  | { type: "links"; total: number }
  | { type: "product"; index: number; total: number; product: Product }
  | { type: "error"; message: string; url?: string }
  | { type: "done"; total: number };

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function autoScroll(page: Page, maxScrolls: number) {
  let lastHeight = 0;
  for (let i = 0; i < maxScrolls; i++) {
    const h = await page.evaluate(() => document.body.scrollHeight);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await sleep(1200);
    if (h === lastHeight) break;
    lastHeight = h;
  }
}

/** Tebakan link produk untuk marketplace umum (Tokopedia, Shopee, Lazada, Bukalapak, dll). */
function isProductLink(href: string, storeUrl: string): boolean {
  let u: URL;
  try {
    u = new URL(href);
  } catch {
    return false;
  }
  if (!/^https?:$/.test(u.protocol)) return false;
  const store = new URL(storeUrl);
  if (u.hostname !== store.hostname) return false;

  // Shopee: /nama-produk-i.{shopid}.{itemid}
  if (/-i\.\d+\.\d+/.test(u.pathname)) return true;

  // Pola umum
  if (/\/(product|products|produk|item|p)\/[^/]+/i.test(u.pathname)) return true;

  // Tokopedia: /{namatoko}/{slug-produk}
  if (u.hostname.includes("tokopedia.com")) {
    const seg = u.pathname.split("/").filter(Boolean);
    const shop = store.pathname.split("/").filter(Boolean)[0];
    const blocked = ["etalase", "review", "product", "info", "page", "catalog", "feed", "sort"];
    return seg.length === 2 && seg[0] === shop && !blocked.includes(seg[1]);
  }
  return false;
}

async function collectLinks(page: Page, opts: ScrapeOptions): Promise<string[]> {
  const selector = opts.linkSelector?.trim();
  const hrefs: string[] = await page.$$eval(
    selector || "a[href]",
    (as) => as.map((a) => (a as HTMLAnchorElement).href)
  );
  const set = new Set<string>();
  for (const h of hrefs) {
    if (!selector && !isProductLink(h, opts.url)) continue;
    try {
      const u = new URL(h);
      u.hash = "";
      u.search = "";
      set.add(u.toString());
    } catch {}
  }
  return [...set];
}

async function extractProduct(page: Page, url: string): Promise<Product> {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2000);

  const data = await page.evaluate(() => {
    const meta = (n: string) =>
      document.querySelector(`meta[property="${n}"],meta[name="${n}"]`)?.getAttribute("content") || "";

    const blocks: any[] = [];
    document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
      try {
        const j = JSON.parse(s.textContent || "");
        if (Array.isArray(j)) blocks.push(...j);
        else if (j && j["@graph"]) blocks.push(...j["@graph"]);
        else blocks.push(j);
      } catch {}
    });
    const hasType = (b: any, t: string) => ([] as string[]).concat(b?.["@type"] ?? []).includes(t);
    const prod = blocks.find((b) => hasType(b, "Product")) || {};
    const crumbs = blocks.find((b) => hasType(b, "BreadcrumbList"));

    // Gambar
    const imgs: string[] = [];
    const pushImg = (v: any) => {
      if (!v) return;
      if (typeof v === "string") imgs.push(v);
      else if (Array.isArray(v)) v.forEach(pushImg);
      else if (v.url) imgs.push(v.url);
      else if (v.contentUrl) imgs.push(v.contentUrl);
    };
    pushImg(prod.image);
    pushImg(meta("og:image"));
    if (imgs.length < 2) {
      document.querySelectorAll("img").forEach((im) => {
        const el = im as HTMLImageElement;
        if (el.naturalWidth >= 400 && el.src && !el.src.startsWith("data:")) imgs.push(el.src);
      });
    }

    // Kategori
    let category = typeof prod.category === "string" ? prod.category : "";
    if (!category && crumbs?.itemListElement) {
      const names = crumbs.itemListElement
        .map((i: any) => i.name || i.item?.name)
        .filter(Boolean);
      category = names.slice(0, -1).join(" > ");
    }
    if (!category) category = meta("product:category") || meta("article:section");

    // Harga
    const offer = Array.isArray(prod.offers) ? prod.offers[0] : prod.offers;
    const price = String(offer?.price ?? offer?.lowPrice ?? meta("product:price:amount") ?? "");

    return {
      title: prod.name || meta("og:title") || document.querySelector("h1")?.textContent?.trim() || document.title,
      description: prod.description || meta("og:description") || meta("description"),
      category,
      price,
      images: imgs,
    };
  });

  const abs = (s: string) => {
    try {
      return new URL(s, url).toString();
    } catch {
      return "";
    }
  };
  return {
    url,
    title: (data.title || "").trim(),
    category: (data.category || "").trim(),
    description: (data.description || "").trim(),
    price: data.price,
    images: [...new Set(data.images.map(abs).filter(Boolean))],
  };
}

export async function scrapeStore(opts: ScrapeOptions, emit: (e: ScrapeEvent) => void) {
  const maxProducts = opts.maxProducts ?? 50;
  const cdp = opts.cdpUrl || process.env.CDP_URL;
  // Mode CDP: tempel ke Chrome asli milik pengguna (lolos deteksi bot, sesi login terpakai)
  const browser = cdp ? await chromium.connectOverCDP(cdp) : await chromium.launch({ headless: true });
  const context = cdp
    ? browser.contexts()[0]
    : await browser.newContext({ userAgent: UA, locale: "id-ID", viewport: { width: 1366, height: 900 } });
  if (cdp) emit({ type: "status", message: "Terhubung ke Chrome lokal (CDP)..." });

  try {
    const page = await context.newPage();
    emit({ type: "status", message: "Membuka halaman toko..." });
    await page.goto(opts.url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(3000);

    emit({ type: "status", message: "Scroll untuk memuat semua produk..." });
    await autoScroll(page, opts.maxScrolls ?? 15);

    const links = (await collectLinks(page, opts)).slice(0, maxProducts);
    emit({ type: "links", total: links.length });
    await page.close();

    if (links.length === 0) {
      emit({
        type: "error",
        message:
          "Tidak ada link produk ditemukan. Coba isi 'CSS selector link produk' manual, atau marketplace memblokir akses (captcha/login).",
      });
      emit({ type: "done", total: 0 });
      return;
    }

    let next = 0;
    let done = 0;
    const worker = async () => {
      const p = await context.newPage();
      await p.route("**/*", (route) => {
        const t = route.request().resourceType();
        return t === "font" || t === "media" ? route.abort() : route.continue();
      });
      while (true) {
        const i = next++;
        if (i >= links.length) break;
        try {
          const product = await extractProduct(p, links[i]);
          done++;
          emit({ type: "product", index: done, total: links.length, product });
        } catch (err: any) {
          done++;
          emit({ type: "error", message: err?.message ?? "Gagal", url: links[i] });
        }
        await sleep(600 + Math.random() * 800); // jeda sopan
      }
      await p.close();
    };
    await Promise.all(Array.from({ length: opts.concurrency ?? 3 }, worker));
    emit({ type: "done", total: links.length });
  } finally {
    await browser.close();
  }
}
