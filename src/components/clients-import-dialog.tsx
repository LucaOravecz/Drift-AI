"use client";

import { useMemo, useState } from "react";
import { Upload, FileSpreadsheet, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const TEMPLATE_HEADERS = ["name", "email", "type", "riskProfile", "aum", "phone"];
const TEMPLATE_CSV = `${TEMPLATE_HEADERS.join(",")}\nAcme Family Office,ops@acme.com,HOUSEHOLD,Moderate,12500000,312-555-0100`;

function parseCsvPreview(csv: string) {
  const rows = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (rows.length === 0) {
    return { headers: [] as string[], previewRows: [] as string[][], rowCount: 0 };
  }

  const headers = rows[0].split(",").map((value) => value.trim());
  const previewRows = rows.slice(1, 4).map((line) => line.split(",").map((value) => value.trim()));

  return {
    headers,
    previewRows,
    rowCount: Math.max(rows.length - 1, 0),
  };
}

export function ClientsImportDialog() {
  const [csvInput, setCsvInput] = useState(TEMPLATE_CSV);
  const preview = useMemo(() => parseCsvPreview(csvInput), [csvInput]);

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "drift-client-import-template.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    toast.message("CSV preview is ready.", {
      description: "The backend import pipeline still needs wiring, but your headers and row count look usable.",
    });
  };

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" className="border-white/10 bg-white/5 hover:bg-white/10 text-white" />}>
        <Upload className="mr-2 h-4 w-4" />
        Import CSV
      </DialogTrigger>
      <DialogContent className="max-w-2xl border border-white/10 bg-zinc-950 text-zinc-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <FileSpreadsheet className="h-4 w-4 text-cyan-400" />
            Client Import Prep
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Paste a client CSV to validate the shape before wiring the full import backend. This keeps intake honest while still helping your team prepare clean data.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">CSV Input</div>
              <Textarea
                value={csvInput}
                onChange={(event) => setCsvInput(event.target.value)}
                className="min-h-[240px] border-white/10 bg-black/30 font-mono text-xs text-zinc-200"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/5 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-emerald-300/80">Detected Rows</div>
              <div className="mt-2 text-3xl font-semibold text-zinc-50">{preview.rowCount}</div>
              <p className="mt-2 text-xs text-zinc-400">Header row excluded.</p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Headers</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {preview.headers.length > 0 ? preview.headers.map((header) => (
                  <span key={header} className="rounded-md border border-white/10 bg-black/30 px-2 py-1 text-xs text-zinc-300">
                    {header}
                  </span>
                )) : (
                  <span className="text-xs text-zinc-500">Paste CSV content to inspect headers.</span>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Template Fields</div>
              <p className="mt-2 text-xs leading-5 text-zinc-400">
                Recommended columns: {TEMPLATE_HEADERS.join(", ")}.
              </p>
            </div>
          </div>
        </div>

        {preview.previewRows.length > 0 ? (
          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Preview</div>
            <div className="mt-3 space-y-2">
              {preview.previewRows.map((row, index) => (
                <div key={`${row.join("-")}-${index}`} className="grid gap-2 rounded-lg border border-white/5 bg-white/[0.02] p-3 text-xs text-zinc-300">
                  {row.map((value, valueIndex) => (
                    <div key={`${value}-${valueIndex}`} className="flex items-center justify-between gap-3">
                      <span className="text-zinc-500">{preview.headers[valueIndex] ?? `Column ${valueIndex + 1}`}</span>
                      <span className="text-right text-zinc-200">{value || "—"}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={downloadTemplate}>
            <Download className="mr-2 h-4 w-4" />
            Download Template
          </Button>
          <Button type="button" onClick={handleImportClick}>
            Validate Import Prep
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
