"use client";

import { useId, useState } from "react";

type Row = { label: string; text: string };

export function Accordion({
  title,
  rows,
  evidence,
}: {
  title: string;
  rows: Row[];
  evidence?: { label: string; url: string } | null;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className="card">
      <button
        type="button"
        className="acc-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{title}</span>
        <span className="toggle-icon" aria-hidden="true">⌄</span>
      </button>
      <div id={panelId} className="acc-panel" hidden={!open}>
        <dl>
          {rows.map((r) => (
            <div key={r.label} style={{ display: "contents" }}>
              <dt>{r.label}</dt>
              <dd>{r.text}</dd>
            </div>
          ))}
        </dl>
        {evidence && (
          <p className="evidence-link">
            <a href={evidence.url} target="_blank" rel="noopener noreferrer">
              {evidence.label}
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
