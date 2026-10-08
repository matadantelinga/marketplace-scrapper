"use client";

import { useRef, useState } from "react";

type Product = {
  url: string;
  title: string;
  category: string;
  description: string;
  price: string;
  images: string[];
};

export default function Home() {
  const [url, setUrl] = useState("");
  const [maxProducts, setMaxProducts] = useState(50);
  const [linkSelector, setLinkSelector] = useState("");
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [products, setProducts] = useState<Product[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  async function start() {
    setRunning(true);
    setProducts([]);
    setErrors([]);
    setProgress({ done: 0, total: 0 });
    setStatus("Memulai...");
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, maxProducts, linkSelector }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) throw new Error((await res.json().catch(() => null))?.error ?? "Request gagal");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const e = JSON.parse(line);
          if (e.type === "status") setStatus(e.message);
          if (e.type === "links") {
            setProgress({ done: 0, total: e.total });
            setStatus(`Ditemukan ${e.total} link produk, mengambil detail...`);
          }
          if (e.type === "product") {
            setProducts((p) => [...p, e.product]);
            setProgress({ done: e.index, total: e.total });
          }
          if (e.type === "error") setErrors((x) => [...x, `${e.url ?? ""} ${e.message}`.trim()]);
          if (e.type === "done") setStatus("Selesai");
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") setErrors((x) => [...x, err.message]);
      setStatus("Dihentikan");
    } finally {
      setRunning(false);
    }
  }

  function downloadJson() {
    const blob = new Blob([JSON.stringify(products, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "produk.json";
    a.click();
  }

  return (
    <main>
      <h1>Marketplace Crawler</h1>
      <p className="muted">Tempel link halaman toko, lalu ambil judul, kategori, foto, dan deskripsi semua produk.</p>

      <div className="card">
        <label>Link halaman toko</label>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.tokopedia.com/nama-toko" />

        <div className="row">
          <div>
            <label>Maks. produk</label>
            <input type="number" min={1} max={500} value={maxProducts} onChange={(e) => setMaxProducts(+e.target.value)} />
          </div>
          <div style={{ flex: 2 }}>
            <label>CSS selector link produk (opsional)</label>
            <input value={linkSelector} onChange={(e) => setLinkSelector(e.target.value)} placeholder='mis. a[data-testid="lnkProductContainer"]' />
          </div>
        </div>

        <div className="row">
          <button onClick={start} disabled={running || !url}>{running ? "Berjalan..." : "Mulai ambil data"}</button>
          {running && <button className="secondary" onClick={() => abortRef.current?.abort()}>Stop</button>}
          {products.length > 0 && <button className="secondary" onClick={downloadJson}>Download JSON ({products.length})</button>}
        </div>
      </div>

      {status && (
        <p className="muted">
          {status} {progress.total > 0 && `— ${progress.done}/${progress.total}`}
        </p>
      )}
      {progress.total > 0 && (
        <div className="bar"><div style={{ width: `${(progress.done / progress.total) * 100}%` }} /></div>
      )}
      {errors.length > 0 && (
        <details className="errors"><summary>{errors.length} error</summary>{errors.map((e, i) => <div key={i}>{e}</div>)}</details>
      )}

      <div className="grid">
        {products.map((p) => (
          <article key={p.url} className="card">
            {p.images[0] && <img src={p.images[0]} alt={p.title} referrerPolicy="no-referrer" />}
            <h3>{p.title}</h3>
            <p className="muted">{p.category || "—"} {p.price && `· ${p.price}`}</p>
            <p className="desc">{p.description.slice(0, 160)}{p.description.length > 160 && "…"}</p>
            <p className="muted">{p.images.length} foto · <a href={p.url} target="_blank">buka</a></p>
          </article>
        ))}
      </div>
    </main>
  );
}
