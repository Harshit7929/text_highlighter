App.jsx


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
            className="ref-btn"
            onClick={() => handleRefClick(refNum)}
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

  // Zoom helpers (only affect PDF side)
  const minZoom = 0.6;
  const maxZoom = 1.6;
  const step = 0.1;

  const zoomIn = () =>
    setZoom((z) => Math.min(maxZoom, +(z + step).toFixed(2)));
  const zoomOut = () =>
    setZoom((z) => Math.max(minZoom, +(z - step).toFixed(2)));
  const resetZoom = () => setZoom(0.9);

  return (
    <div className="app-root-simple">
      {/* LEFT: PDF viewer */}
      <div className="left-column">
        <div className="left-header">
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

        {/* IMPORTANT FIX: removed file={pdfUrl} */}
        <PdfViewer ref={viewerRef} zoom={zoom} />
      </div>

      {/* RIGHT: analysis text + search */}
      <div className="right-column">
        <h3>Analysis / Findings / Supporting Evidence</h3>

        <div className="analysis-body">
          {visibleParagraphs.map((p, idx) => renderParagraph(p, idx))}
        </div>

        <div className="search-bar">
          <input
            type="text"
            placeholder="Search in analysis text…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button type="button" className="small" onClick={handleClear}>
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
