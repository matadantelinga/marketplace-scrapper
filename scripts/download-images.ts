// Pemakaian: npm run download-images -- produk.json
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const file = process.argv[2] ?? "produk.json";
const products = JSON.parse(await readFile(file, "utf8")) as { title: string; images: string[] }[];
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "produk";

for (const [i, p] of products.entries()) {
  const dir = path.join("downloads", `${String(i + 1).padStart(3, "0")}-${slug(p.title)}`);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "info.json"), JSON.stringify(p, null, 2));
  for (const [j, src] of p.images.entries()) {
    try {
      const res = await fetch(src);
      if (!res.ok) continue;
      const ext = (res.headers.get("content-type") ?? "image/jpeg").split("/")[1]?.split(";")[0] || "jpg";
      await writeFile(path.join(dir, `${j + 1}.${ext}`), Buffer.from(await res.arrayBuffer()));
    } catch {}
  }
  console.log(`✓ ${dir}`);
}
