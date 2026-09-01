"use client";

import { useEffect, useRef, useState } from "react";

type IdentifyMode = "sku" | "url";
type BuildState = "idle" | "processing" | "done";
type StageStatus = "pending" | "active" | "completed";

const STAGES = [
  "Validate source",
  "Extract specifications",
  "Generate product twin",
];

function CornerBrackets() {
  const base = "absolute h-5 w-5 border-teal/70";
  return (
    <>
      <span className={`${base} top-0 left-0 border-t-2 border-l-2`} />
      <span className={`${base} top-0 right-0 border-t-2 border-r-2`} />
      <span className={`${base} bottom-0 left-0 border-b-2 border-l-2`} />
      <span className={`${base} bottom-0 right-0 border-b-2 border-r-2`} />
    </>
  );
}

function UploadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <path d="M12 3v12" />
      <path d="M7 8l5-5 5 5" />
      <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5 shrink-0"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
    >
      <path d="M18 6 6 18" />
      <path d="M6 6l12 12" />
    </svg>
  );
}

function CheckIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export default function Home() {
  const [mode, setMode] = useState<IdentifyMode>("sku");
  const [identifyValue, setIdentifyValue] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [buildState, setBuildState] = useState<BuildState>("idle");
  const [activeStage, setActiveStage] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const canBuild =
    (identifyValue.trim().length > 0 || fileName !== null) &&
    buildState === "idle";

  function handleFile(file: File | null) {
    if (file && file.type === "application/pdf") {
      setFileName(file.name);
    }
  }

  function handleBuild() {
    if (!canBuild) return;
    setActiveStage(0);
    setBuildState("processing");
  }

  function reset() {
    setBuildState("idle");
    setActiveStage(0);
  }

  useEffect(() => {
    if (buildState !== "processing") return;

    if (activeStage >= STAGES.length) {
      const t = setTimeout(() => setBuildState("done"), 450);
      return () => clearTimeout(t);
    }

    const t = setTimeout(() => setActiveStage((s) => s + 1), 900);
    return () => clearTimeout(t);
  }, [buildState, activeStage]);

  function stageStatus(index: number): StageStatus {
    if (index < activeStage) return "completed";
    if (index === activeStage && buildState === "processing") return "active";
    return "pending";
  }

  const progressPercent = Math.min(
    (activeStage / STAGES.length) * 100,
    100
  );

  const statusText =
    buildState === "idle"
      ? identifyValue.trim() || fileName
        ? "Ready to scan"
        : "Awaiting input"
      : buildState === "processing"
        ? "Building digital twin…"
        : "Digital twin generated";

  return (
    <div className="relative min-h-screen overflow-hidden bg-ink">
      <div className="bg-blueprint-grid animate-blueprint-pulse pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink via-transparent to-ink" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[36rem] -translate-x-1/2 rounded-full bg-teal/10 blur-3xl" />

      <main className="relative flex min-h-screen flex-col items-center px-6 py-14 sm:py-20">
        <div className="animate-fade-up flex flex-col items-center text-center">
          <div className="mb-5 flex items-center gap-2 rounded-full border border-line bg-panel/60 px-3 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-teal shadow-[0_0_8px_rgba(79,224,196,0.9)]" />
            <span className="font-mono text-[11px] tracking-[0.2em] text-mist uppercase">
              Product Intelligence Engine
            </span>
          </div>

          <h1 className="font-display text-4xl font-semibold tracking-tight text-ivory sm:text-6xl">
            Product<span className="text-teal">Twin</span>
          </h1>

          <p className="mt-4 max-w-md text-sm text-mist sm:text-base">
            Feed in a SKU, a product URL, or a spec sheet. We build a structured
            digital twin — instantly.
          </p>
        </div>

        <div className="animate-fade-up relative mt-12 w-full max-w-xl">
          <div className="relative border border-line bg-panel/80 p-6 backdrop-blur-sm sm:p-8">
            <CornerBrackets />

            {buildState === "processing" && (
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="animate-scan absolute inset-x-0 h-24 bg-gradient-to-b from-transparent via-teal/15 to-transparent" />
              </div>
            )}

            {buildState === "done" ? (
              <div className="flex flex-col items-center gap-4 py-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-teal/40 bg-teal/10">
                  <CheckIcon className="h-6 w-6 text-teal" />
                </div>

                <div>
                  <p className="font-display text-lg font-medium text-ivory">
                    Twin ready
                  </p>
                  <p className="mt-1 font-mono text-xs text-mist">
                    {(fileName ?? identifyValue) || "SOURCE"} → structured
                    model (demo)
                  </p>
                </div>

                <button
                  onClick={reset}
                  className="mt-2 font-mono text-xs tracking-wide text-mist underline decoration-line underline-offset-4 transition hover:text-teal focus-visible:text-teal focus-visible:outline-none"
                >
                  Build another
                </button>
              </div>
            ) : buildState === "processing" ? (
              <div className="py-2">
                <span className="font-mono text-[11px] tracking-[0.2em] text-teal uppercase">
                  Building Digital Twin
                </span>

                <p className="mt-1 text-xs text-mist">
                  {(fileName ?? identifyValue) || "SOURCE"}
                </p>

                <div className="mt-6 h-1 w-full overflow-hidden rounded-full bg-panel-2">
                  <div
                    className="h-full rounded-full bg-teal transition-all duration-500 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                <ul className="mt-6 flex flex-col gap-3">
                  {STAGES.map((label, i) => {
                    const status = stageStatus(i);

                    return (
                      <li
                        key={label}
                        className={`flex items-center gap-3 rounded-md border px-3 py-2.5 transition ${
                          status === "active"
                            ? "border-teal/50 bg-teal/5"
                            : status === "completed"
                              ? "border-line bg-panel-2"
                              : "border-line/60 bg-panel-2/40"
                        }`}
                      >
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-[10px] ${
                            status === "completed"
                              ? "border-teal bg-teal text-ink"
                              : status === "active"
                                ? "border-teal text-teal"
                                : "border-line text-mist"
                          }`}
                        >
                          {status === "completed" ? (
                            <CheckIcon className="h-3.5 w-3.5" />
                          ) : status === "active" ? (
                            <span className="h-1.5 w-1.5 animate-ping rounded-full bg-teal" />
                          ) : (
                            String(i + 1).padStart(2, "0")
                          )}
                        </span>

                        <span
                          className={`font-mono text-xs tracking-wide uppercase ${
                            status === "pending" ? "text-mist" : "text-ivory"
                          }`}
                        >
                          {String(i + 1).padStart(2, "0")} {label}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <>
                <div>
                  <span className="font-mono text-[11px] tracking-[0.2em] text-mist uppercase">
                    01 — Identify product
                  </span>

                  <div className="mt-3 inline-flex rounded-md border border-line bg-panel-2 p-1">
                    {(["sku", "url"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMode(m)}
                        className={`rounded px-3 py-1.5 font-mono text-xs tracking-wide uppercase transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal ${
                          mode === m
                            ? "bg-teal text-ink"
                            : "text-mist hover:text-ivory"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>

                  <input
                    type="text"
                    value={identifyValue}
                    onChange={(e) => setIdentifyValue(e.target.value)}
                    placeholder={
                      mode === "sku"
                        ? "e.g. SKU-4471-BLK"
                        : "e.g. https://brand.com/product/..."
                    }
                    className="mt-3 w-full rounded-md border border-line bg-panel-2 px-4 py-3 font-mono text-sm text-ivory placeholder-mist/60 outline-none transition focus:border-teal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
                  />
                </div>

                <div className="my-6 flex items-center gap-3">
                  <div className="h-px flex-1 bg-line" />
                  <span className="font-mono text-[10px] tracking-[0.2em] text-mist">
                    OR
                  </span>
                  <div className="h-px flex-1 bg-line" />
                </div>

                <div>
                  <span className="font-mono text-[11px] tracking-[0.2em] text-mist uppercase">
                    02 — Upload spec sheet
                  </span>

                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      handleFile(e.dataTransfer.files?.[0] ?? null);
                    }}
                    className={`mt-3 flex flex-col items-center justify-center gap-2 rounded-md border border-dashed px-4 py-6 text-center transition ${
                      isDragging
                        ? "border-teal bg-teal/5"
                        : "border-line bg-panel-2"
                    }`}
                  >
                    {fileName ? (
                      <div className="flex w-full items-center justify-between gap-3 rounded-md border border-line bg-panel px-3 py-2">
                        <div className="flex min-w-0 items-center gap-2 text-ivory">
                          <FileIcon />
                          <span className="truncate font-mono text-xs">
                            {fileName}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => setFileName(null)}
                          aria-label="Remove file"
                          className="rounded p-1 text-mist transition hover:text-amber focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
                        >
                          <CloseIcon />
                        </button>
                      </div>
                    ) : (
                      <>
                        <UploadIcon />

                        <p className="text-xs text-mist">
                          Drop a PDF, or
                        </p>

                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="rounded-md border border-line bg-panel px-3 py-1.5 font-mono text-xs tracking-wide text-ivory uppercase transition hover:border-teal hover:text-teal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
                        >
                          Upload PDF
                        </button>

                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="application/pdf"
                          onChange={(e) =>
                            handleFile(e.target.files?.[0] ?? null)
                          }
                          className="hidden"
                        />
                      </>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={!canBuild}
                  onClick={handleBuild}
                  className={`mt-7 flex w-full items-center justify-center gap-2 rounded-md py-3.5 font-display text-sm font-semibold tracking-[0.08em] uppercase transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal ${
                    canBuild
                      ? "bg-teal text-ink shadow-[0_0_24px_rgba(79,224,196,0.35)] hover:shadow-[0_0_32px_rgba(79,224,196,0.5)]"
                      : "cursor-not-allowed bg-panel-2 text-mist"
                  }`}
                >
                  Build ProductTwin
                </button>
              </>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between font-mono text-[10px] tracking-wide text-mist uppercase">
            <span className="flex items-center gap-1.5">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  buildState === "processing"
                    ? "bg-amber"
                    : "bg-teal shadow-[0_0_6px_rgba(79,224,196,0.8)]"
                }`}
              />
              {statusText}
            </span>

            <span>engine v0.1 · local</span>
          </div>
        </div>
      </main>
    </div>
  );
}
