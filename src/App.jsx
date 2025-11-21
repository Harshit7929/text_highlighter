// src/App.jsx
import React, { useMemo, useRef, useState } from "react";
import PdfViewer from "./pdfViewer";
import "./styles.css";

// Reference number -> phrase + page hint in the PDF
const REFERENCES = {
  1: {
    label: "[1]",
    pageHint: 3,
    phrase: "EBITDA of USD 2.3"
  },
  2: {
    label: "[2]",
    pageHint: 5,
    phrase: "higher revenue and cost management"
  },
  3: {
    label: "[3]",
    pageHint: 15,
    phrase: "Gain on sale of non-current assets"
  }
};

// Full analysis text for the right-hand side
const RAW_TEXT = `
Analysis
No extraordinary or one-off items affecting EBITDA were reported in Maersk’s Q2 2025 results.
The report explicitly notes that EBITDA improvements stemmed from operational performance—
including volume growth, cost control, and margin improvement across Ocean, Logistics &
Services, and Terminals segments [1][2]. Gains or losses from asset sales, which could qualify as
extraordinary items, are shown separately under EBIT and not included in EBITDA. The gain on
sale of non-current assets was USD 25 m in Q2 2025, significantly lower than USD 208 m in Q2
2024, but these affect EBIT, not EBITDA [3]. Hence, Q2 2025 EBITDA reflects core operating
activities without one-off extraordinary adjustments.

Findings
Page 3 — Highlights Q2 2025
EBITDA increase (USD 2.3 bn vs USD 2.1 bn prior year) attributed to operational improvements; no
mention of extraordinary or one-off items. [1]

Page 5 — Review Q2 2025
EBITDA rise driven by higher revenue and cost control across all segments; no extraordinary gains
or losses included. [2]

Page 15 — Condensed Income Statement
Gain on sale of non-current assets USD 25 m (vs USD 208 m prior year) reported separately below
EBITDA; therefore, not part of EBITDA. [3]

Supporting Evidence
[1] A.P. Moller – Maersk Q2 2025 Interim Report (7 Aug 2025) — Page 3 →
“Maersk’s results continued to improve year-on-year … EBITDA of USD 2.3 bn (USD 2.1 bn) …
driven by volume and other revenue growth in Ocean, margin improvements in Logistics &
Services and significant top line growth in Terminals.”

[2] A.P. Moller – Maersk Q2 2025 Interim Report (7 Aug 2025) — Page 5 →
“EBITDA increased to USD 2.3 bn (USD 2.1 bn) … driven by higher revenue and cost management
… Ocean’s EBITDA … slightly increased by USD 36 m … Logistics & Services contributed
significantly with a USD 71 m increase … Terminals’ EBITDA increased by USD 50 m.”

[3] A.P. Moller – Maersk Q2 2025 Interim Report (7 Aug 2025) — Page 15 →
“Gain on sale of non-current assets, etc., net 25 (208) … Profit before depreciation, amortisation
and impairment losses, etc. (EBITDA) 2,298.”
`;

export default function App() {
  const viewerRef = useRef(null);

  const [activeRefNum, setActiveRefNum] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [zoom, setZoom] = useState(0.9); // PDF zoom only
  const [dark, setDark] = useState(false);

  // For display only (download link). We intentionally do not pass file to PdfViewer
  // because your previous fix removed file prop to avoid missing-PDF errors on some previews.
  const pdfUrl = `${import.meta.env.BASE_URL || "/"}report.pdf`;

  const activeRef = activeRefNum ? REFERENCES[activeRefNum] : null;

  // Split analysis text into paragraphs
  const paragraphs = useMemo(
    () =>
      RAW_TEXT.split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean),
    []
  );

  // Filter analysis text by search box on the right
  const visibleParagraphs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return paragraphs;
    return paragraphs.filter((p) => p.toLowerCase().includes(q));
  }, [paragraphs, searchQuery]);

  // Clicking [1], [2], [3]
  const handleRefClick = async (refNum) => {
    const refMeta = REFERENCES[refNum];
    if (!refMeta) return;

    setActiveRefNum(refNum);

    if (viewerRef.current && viewerRef.current.highlightPhrase) {
      await viewerRef.current.highlightPhrase({
        phrase: refMeta.phrase,
        pageHint: refMeta.pageHint
      });
    }
  };

  // Turn [n] in text into clickable buttons
  const renderParagraph = (text, index) => {
    const parts = [];
    const regex = /\[(\d+)\]/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const before = text.slice(lastIndex, match.index);
      if (before) {
        parts.push(<span key={`t-${index}-${lastIndex}`}>{before}</span>);
      }

      const refNum = parseInt(match[1], 10);
      const refMeta = REFERENCES[refNum];

      if (refMeta) {
        parts.push(
          <button
            key={`ref-${index}-${refNum}-${match.index}`}
            type="button"
            className={`ref-btn ${activeRefNum === refNum ? "active-ref" : ""}`}
            onClick={() => handleRefClick(refNum)}
            title={`Jump to ${refMeta.label} (page ${refMeta.pageHint})`}
          >
            [{refNum}]
          </button>
        );
      } else {
        parts.push(
          <span key={`plain-${index}-${refNum}-${match.index}`}>[{refNum}]</span>
        );
      }

      lastIndex = regex.lastIndex;
    }

    const remaining = text.slice(lastIndex);
    if (remaining) {
      parts.push(<span key={`t-${index}-end`}>{remaining}</span>);
    }

    return (
      <p key={index} style={{ whiteSpace: "pre-wrap", marginBottom: 8 }}>
        {parts}
      </p>
    );
  };

  const handleClear = () => {
    setSearchQuery("");
    setActiveRefNum(null);
    if (viewerRef.current && viewerRef.current.clearHighlights) {
      viewerRef.current.clearHighlights();
    }
  };

  // Zoom helpers (only affect PdfViewer)
  const minZoom = 0.6;
  const maxZoom = 1.6;
  const step = 0.1;

  const zoomIn = () =>
    setZoom((z) => Math.min(maxZoom, +(z + step).toFixed(2)));
  const zoomOut = () =>
    setZoom((z) => Math.max(minZoom, +(z - step).toFixed(2)));
  const resetZoom = () => setZoom(0.9);

  return (
    <div className={`app-root-simple ${dark ? "theme-dark" : ""}`} style={{ height: "100vh" }}>
      {/* Top nav */}
      <header className="app-topbar" style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 12px",
        borderBottom: "1px solid #ddd",
        background: dark ? "#111" : "#fff",
        zIndex: 10
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>CloudMotiv — PDF Inspector</h2>
          <span style={{ color: "#888", fontSize: 13 }}>Highlight & link analysis</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <a
            href={pdfUrl}
            download
            className="small"
            style={{ textDecoration: "none" }}
            title="Download the report PDF"
          >
            Download PDF
          </a>
          <button
            className="small"
            onClick={() => setDark((d) => !d)}
            title="Toggle theme"
          >
            {dark ? "Light" : "Dark"}
          </button>
          <a
            className="small"
            href="https://github.com/Harshit7929/text_highlighter"
            target="_blank"
            rel="noreferrer"
            title="Open repo"
            style={{ textDecoration: "none" }}
          >
            Repo
          </a>
        </div>
      </header>

      {/* Main content */}
      <div style={{ display: "flex", height: "calc(100% - 50px)" }}>
        {/* LEFT: PDF viewer */}
        <div className="left-column" style={{ display: "flex", flexDirection: "column" }}>
          <div className="left-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <strong>PDF</strong>
              <div style={{ marginLeft: 12, display: "flex", alignItems: "center" }}>
                <button className="small" onClick={zoomOut}>-</button>
                <button className="small" onClick={zoomIn} style={{ marginLeft: 4, marginRight: 4 }}>+</button>
                <button className="small" onClick={resetZoom}>100%</button>
                <span style={{ marginLeft: 8, fontSize: 12 }}>
                  Zoom: {Math.round(zoom * 100)}%
                </span>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* quick jump links */}
              <button
                className="small"
                onClick={async () => {
                  if (viewerRef.current?.highlightPhrase) {
                    await viewerRef.current.highlightPhrase({ phrase: REFERENCES[1].phrase, pageHint: REFERENCES[1].pageHint });
                    setActiveRefNum(1);
                  }
                }}
              >
                Jump [1]
              </button>
              <button className="small" onClick={() => { setActiveRefNum(null); viewerRef.current?.clearHighlights?.(); }}>
                Clear
              </button>
            </div>
          </div>

          <div style={{ flex: 1, minHeight: 0 }}>
            {/* IMPORTANT: keep not passing file prop (your prior fix) */}
            <PdfViewer ref={viewerRef} zoom={zoom} />
          </div>
        </div>

        {/* RIGHT: analysis text + search */}
        <aside className="right-column" style={{ width: 420, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h3 style={{ margin: "8px 0" }}>Analysis / Findings / Supporting Evidence</h3>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="text"
                placeholder="Search in analysis text…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #ccc" }}
                aria-label="Search analysis"
              />
              <button className="small" onClick={handleClear}>Clear</button>
            </div>
          </div>

          <div style={{ fontSize: 13, color: "#444", marginBottom: 8 }}>
            <strong>Instructions:</strong> Click any reference like <em>[1]</em> to jump to the corresponding phrase in the PDF.
          </div>

          <div className="analysis-body" style={{ flex: 1, overflowY: "auto", paddingRight: 6 }}>
            {visibleParagraphs.map((p, idx) => renderParagraph(p, idx))}
          </div>

          <div style={{ paddingTop: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 12, color: "#666" }}>
                <strong>Legend</strong>: <span style={{ marginLeft: 8 }}>Yellow = matched phrase highlight</span>
              </div>
              <div style={{ fontSize: 12, color: "#666" }}>
                <button className="small" onClick={() => window.open(pdfUrl, "_blank")}>Open PDF</button>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Footer */}
      <footer style={{
        borderTop: "1px solid #eee",
        padding: "8px 12px",
        fontSize: 12,
        color: "#666",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}>
        <div>© {new Date().getFullYear()} CloudMotiv — PDF Highlight Demo</div>
        <div>
          <a href="https://github.com/Harshit7929/text_highlighter" target="_blank" rel="noreferrer" style={{ color: "#666", textDecoration: "none" }}>Source</a>
        </div>
      </footer>
    </div>
  );
}
