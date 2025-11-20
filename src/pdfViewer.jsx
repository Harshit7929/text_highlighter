// src/pdfViewer.jsx

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState
} from "react";

// Use the legacy build of pdf.js (works with bundlers)
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";

// Worker from public folder (works on GitHub Pages)
pdfjsLib.GlobalWorkerOptions.workerSrc = import.meta.env.BASE_URL + "pdf.worker.js";

const PdfViewer = forwardRef(function PdfViewer({ file, zoom = 0.9 }, ref) {
  const containerRef = useRef(null);
  const [pdf, setPdf] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [error, setError] = useState(null);
  const [highlights, setHighlights] = useState([]);
  const pageInfo = useRef({}); // page -> { scale, viewportHeight, offsetTop, offsetLeft }

  // Load PDF document
  useEffect(() => {
    let cancelled = false;
    setError(null);
    setHighlights([]);
    pageInfo.current = {};

    if (!file) return;

    (async () => {
      try {
        // FIXED: use pdfjsLib.getDocument instead of getDocument
        const task = pdfjsLib.getDocument(file);
        const pdfDoc = await task.promise;

        if (cancelled) {
          await pdfDoc.destroy();
          return;
        }

        setPdf(pdfDoc);
        setNumPages(pdfDoc.numPages);

      } catch (e) {
        if (!cancelled) setError(e?.message || String(e));
      }
    })();

    return () => {
      cancelled = true;
      if (pdf) pdf.destroy();
    };
  }, [file]);


  // Re-render pages whenever pdf/numPages/zoom changes
  useEffect(() => {
    if (!pdf || !numPages || !containerRef.current) return;

    const scale = zoom || 0.9;
    const meta = {};

    const renderPages = async () => {
      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();

      for (let pageNumber = 1; pageNumber <= numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale });

        const canvas = container.querySelector(`#pdf-page-${pageNumber}`);
        if (!canvas) continue;

        const ctx = canvas.getContext("2d");
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({ canvasContext: ctx, viewport }).promise;

        const wrapper = canvas.parentElement;
        const canvasRect = canvas.getBoundingClientRect();

        meta[pageNumber] = {
          scale,
          viewportHeight: viewport.height,
          offsetTop: wrapper ? wrapper.offsetTop : 0,
          offsetLeft: canvasRect.left - containerRect.left
        };
      }

      pageInfo.current = meta;
    };

    // clear old highlight when zoom changes
    setHighlights([]);
    renderPages().catch((e) => setError(e?.message || String(e)));
  }, [pdf, numPages, zoom]);

  const scrollToRect = (rect) => {
    const c = containerRef.current;
    if (!c) return;
    const ch = c.clientHeight || 600;

    const desired = rect.top - ch / 2 + rect.height / 2;
    const maxScroll = Math.max(0, c.scrollHeight - ch);
    const pos = Math.max(0, Math.min(desired, maxScroll));

    try {
      c.scrollTo({ top: pos, behavior: "smooth" });
    } catch {
      c.scrollTop = pos;
    }
  };

  useImperativeHandle(ref, () => ({
    async highlightPhrase({ phrase, pageHint }) {
      if (!pdf || !phrase) return false;
      const target = phrase.trim().toLowerCase();
      if (!target) return false;

      const total = pdf.numPages;
      const order = [];

      if (pageHint && pageHint >= 1 && pageHint <= total) order.push(pageHint);
      for (let p = 1; p <= total; p++) {
        if (!order.includes(p)) order.push(p);
      }

      for (const pageNumber of order) {
        const page = await pdf.getPage(pageNumber);
        const textContent = await page.getTextContent();

        const items = textContent.items.map((it) => ({
          str: it.str || "",
          transform: it.transform || [1, 0, 0, 1, 0, 0],
          width: it.width || 0,
          height: it.height || 10
        }));

        // ---------- 1) Try single-item substring highlight ----------
        for (let i = 0; i < items.length; i++) {
          const s = items[i].str;
          const lower = s.toLowerCase();
          const idx = lower.indexOf(target);
          if (idx === -1) continue;

          const it = items[i];
          const t = it.transform;
          const x = t[4];
          const y = t[5];
          const w = it.width || it.str.length * 5;
          const h = it.height || 10;

          const charCount = s.length || 1;
          const startFrac = idx / charCount;
          const endFrac = (idx + target.length) / charCount;

          const leftX = x + w * startFrac;
          const rightX = x + w * endFrac;

          const meta = pageInfo.current[pageNumber];
          if (!meta || !containerRef.current) continue;

          const { scale, viewportHeight, offsetTop, offsetLeft } = meta;

          const textTopPdf = y - h;
          const top =
            offsetTop + (viewportHeight - textTopPdf * scale) - h * scale;
          const height = h * scale;

          const baseWidth = (rightX - leftX) * scale;
          const baseLeft = offsetLeft + leftX * scale;

          const pad = 3;
          const rect = {
            left: baseLeft - pad,
            top: top - pad,
            width: baseWidth + pad * 2,
            height: height + pad * 2
          };

          // nudge slightly up
          rect.top -= 6;

          setHighlights([rect]);
          scrollToRect(rect);
          return true;
        }

        // ---------- 2) Fallback multi-item bounding box ----------
        const full = items.map((i) => i.str).join(" ").toLowerCase();
        const idx = full.indexOf(target);
        if (idx === -1) continue;

        let cumulative = 0;
        let startItem = -1;
        let endItem = -1;

        for (let i = 0; i < items.length; i++) {
          const s = items[i].str;
          const next = cumulative + s.length + 1;
          if (startItem === -1 && idx < next) startItem = i;
          if (startItem !== -1 && idx + target.length <= next) {
            endItem = i;
            break;
          }
          cumulative = next;
        }

        if (startItem === -1) startItem = 0;
        if (endItem === -1) endItem = startItem;

        let minX = Infinity,
          minY = Infinity,
          maxX = -Infinity,
          maxY = -Infinity;

        for (let i = startItem; i <= endItem; i++) {
          const it = items[i];
          const t = it.transform;
          const x = t[4];
          const y = t[5];
          const w = it.width || it.str.length * 5;
          const h = it.height || 10;

          minX = Math.min(minX, x);
          minY = Math.min(minY, y - h);
          maxX = Math.max(maxX, x + w);
          maxY = Math.max(maxY, y);
        }

        const meta = pageInfo.current[pageNumber];
        if (!meta || !containerRef.current) continue;

        const { scale, viewportHeight, offsetTop, offsetLeft } = meta;

        const baseLeft = offsetLeft + minX * scale;
        const top = offsetTop + (viewportHeight - maxY * scale);
        const baseWidth = (maxX - minX) * scale;
        const height = (maxY - minY) * scale;

        const pad = 4;
        const rect = {
          left: baseLeft - pad,
          top: top - pad,
          width: baseWidth + pad * 2,
          height: height + pad * 2
        };

        // same upward nudge
        rect.top -= 6;

        setHighlights([rect]);
        scrollToRect(rect);
        return true;
      }

      return false;
    },

    clearHighlights() {
      setHighlights([]);
    }
  }));

  if (error) {
    return (
      <div style={{ color: "red", padding: 10 }}>
        Failed to load PDF: {error}
      </div>
    );
  }

  return (
    <div className="pdf-border-panel">
      <div className="pdf-scroll-container" ref={containerRef}>
        {Array.from({ length: numPages || 0 }, (_, i) => {
          const pageNumber = i + 1;
          return (
            <div className="pdf-page-wrapper" key={pageNumber}>
              <canvas id={`pdf-page-${pageNumber}`} />
            </div>
          );
        })}

        <div className="highlight-layer">
          {highlights.map((h, idx) => (
            <div
              key={idx}
              className="highlight-box"
              style={{
                left: h.left,
                top: h.top,
                width: h.width,
                height: h.height
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
});

export default PdfViewer;
