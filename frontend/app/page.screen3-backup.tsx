"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type IdentifyMode = "sku" | "url";
type BuildState = "idle" | "processing" | "done";
type StageStatus = "pending" | "active" | "completed";

const STAGES = ["Validate source", "Extract specifications", "Generate product twin"];

const MOCK_CATEGORIES = ["Consumer Electronics", "Home Appliances", "Industrial Hardware", "Furniture"];
const MOCK_MATERIALS = ["Anodized Aluminum", "ABS Polymer", "Tempered Glass", "Recycled Steel"];
const MOCK_CERTS = ["CE", "RoHS", "FCC", "ISO 9001"];

function seedFromString(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function buildMockTwin(source: string) {
  const seed = seedFromString(source || "PRODUCTTWIN-DEMO");
  const pick = (arr: string[], offset: number) => arr[(seed + offset) % arr.length];
  const skuNum = 1000 + (seed % 8999);

  return {
    name: source && source.length > 2 ? `${pick(["Aero", "Nova", "Orbit", "Vertex"], 1)} ${pick(["Series", "Line", "Edge", "Pro"], 2)}` : "Aero Series Pro",
    sku: `PT-${skuNum}`,
    category: pick(MOCK_CATEGORIES, 3),
    description:
      "Digitally reconstructed product profile generated from the provided source. Includes structured specifications, material breakdown, and compliance signals for downstream product intelligence workflows.",
    confidence: 82 + (seed % 15),
    specs: [
      { label: "Dimensions", value: `${30 + (seed % 20)} x ${20 + (seed % 15)} x ${8 + (seed % 6)} cm` },
      { label: "Weight", value: `${(1 + (seed % 9) / 2).toFixed(1)} kg` },
      { label: "Material", value: pick(MOCK_MATERIALS, 4) },
      { label: "Power", value: `${20 + (seed % 80)}W / 100–240V` },
      { label: "Warranty", value: `${1 + (seed % 3)} year limited` },
      { label: "Color", value: pick(["Graphite", "Arctic White", "Slate", "Onyx"], 5) },
    ],
    materials: [
      { label: "Primary body", value: pick(MOCK_MATERIALS, 6) },
      { label: "Secondary component", value: pick(MOCK_MATERIALS, 7) },
      { label: "Recycled content", value: `${10 + (seed % 40)}%` },
    ],
    compliance: [pick(MOCK_CERTS, 8), pick(MOCK_CERTS, 9), pick(MOCK_CERTS, 10)].filter(
      (v, i, arr) => arr.indexOf(v) === i
    ),
    sustainability: {
      score: 60 + (seed % 35),
      notes: "Estimated from material composition and packaging footprint. Demo value — not verified.",
    },
  };
}

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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M12 3v12" />
      <path d="M7 8l5-5 5 5" />
      <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
      <path d="M18 6 6 18" />
      <path d="M6 6l12 12" />
    </svg>
  );
}

function CheckIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function BoxIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="h-10 w-10">
      <path d="M21 8 12 3 3 8l9 5 9-5Z" />
      <path d="M3 8v8l9 5 9-5V8" />
      <path d="M12 13v8" />
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
  const [source, setSource] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const canBuild =
    (identifyValue.trim().length > 0 || fileName !== null) && buildState === "idle";

  const twin = useMemo(() => buildMockTwin(source), [source]);

  function handleFile(file: File | null) {
    if (file && file.type === "application/pdf") {
      setFileName(file.name);
    }
  }

  function handleBuild() {
    if (!canBuild) return;
    setSource(fileName ?? identifyValue);
    setActiveStage(0);
    setBuildState("processing");
  }

  function reset() {
    setBuildState("idle");
    setActiveStage(0);
    setIdentifyValue("");
    setFileName(null);
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

  const progressPercent = Math.min((activeStage / STAGES.length) * 100, 100);

  const statusText =
    buildState === "idle"
      ? identifyValue.trim() || fileName
        ? "Ready to scan"
        : "Awaiting input"
      : buildState === "processing"
        ? "Building digital twin…"
        : "Digital twin generated";

  const containerWidth = buildState === "done" ? "max-w-4xl" : "max-w-xl";

  return (
    <div className="relative min-h-screen overflow-hidden bg-ink">
      <div className="bg-blueprint-grid animate-blueprint-pulse pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink via-transparent to-ink" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[36rem] -translate-x-1/2 rounded-full bg-teal/10 blur-3xl" />

      <main className="relative flex min-h-screen flex-col items-center px-6 py-14 sm:py-20">
        {buildState !== "done" && (
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
              Feed in a SKU, a product URL, or a spec sheet. We build a structured digital twin — instantly.
            </p>
          </div>
        )}

        <div className={`animate-fade-up relative mt-12 w-full ${containerWidth} transition-all duration-300`}>
          {buildState === "done" ? (
            <div className="relative border border-line bg-panel/80 p-6 backdrop-blur-sm sm:p-8">
              <CornerBrackets />

              {/* Dashboard header */}
              <div className="flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-display text-lg font-semibold text-ivory">
                      Product<span className="text-teal">Twin</span>
                    </span>
                    <span className="rounded-full border border-teal/40 bg-teal/10 px-2 py-0.5 font-mono text-[10px] tracking-wide text-teal uppercase">
                      Digital Twin Generated
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-[10px] tracking-wide text-mist uppercase">
                    Local · Demo Data · Not Connected To Live Source
                  </p>
                </div>
                <button
                  onClick={reset}
                  className="self-start rounded-md border border-line bg-panel-2 px-3 py-1.5 font-mono text-xs tracking-wide text-ivory uppercase transition hover:border-teal hover:text-teal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal sm:self-auto"
                >
                  Build another
                </button>
              </div>

              {/* Product overview */}
              <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-[9rem_1fr]">
                <div className="flex h-36 w-full items-center justify-center rounded-md border border-dashed border-line bg-panel-2 text-mist sm:w-36">
                  <BoxIcon />
                </div>
                <div>
                  <h2 className="font-display text-2xl font-semibold text-ivory">{twin.name}</h2>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-mist">
                    <span>
                      SKU <span className="text-ivory">{twin.sku}</span>
                    </span>
                    <span className="h-1 w-1 rounded-full bg-line" />
                    <span>
                      Category <span className="text-ivory">{twin.category}</span>
                    </span>
                  </div>
                  <p className="mt-3 max-w-2xl text-sm text-mist">{twin.description}</p>
                </div>
              </div>

              {/* Key specifications */}
              <div className="mt-8">
                <span className="font-mono text-[11px] tracking-[0.2em] text-mist uppercase">
                  Key Specifications
                </span>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {twin.specs.map((spec) => (
                    <div key={spec.label} className="rounded-md border border-line bg-panel-2 px-4 py-3">
                      <p className="font-mono text-[10px] tracking-wide text-mist uppercase">{spec.label}</p>
                      <p className="mt-1 text-sm text-ivory">{spec.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Intelligence sections */}
              <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-md border border-line bg-panel-2 p-4">
                  <p className="font-mono text-[11px] tracking-[0.2em] text-mist uppercase">Materials</p>
                  <ul className="mt-3 flex flex-col gap-2">
                    {twin.materials.map((m) => (
                      <li key={m.label} className="flex items-center justify-between text-sm">
                        <span className="text-mist">{m.label}</span>
                        <span className="text-ivory">{m.value}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-md border border-line bg-panel-2 p-4">
                  <p className="font-mono text-[11px] tracking-[0.2em] text-mist uppercase">
                    Compliance / Certifications
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {twin.compliance.map((c) => (
                      <span
                        key={c}
                        className="rounded border border-line bg-panel px-2.5 py-1 font-mono text-[11px] text-ivory"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-md border border-line bg-panel-2 p-4">
                  <p className="font-mono text-[11px] tracking-[0.2em] text-mist uppercase">Sustainability</p>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel">
                      <div
                        className="h-full rounded-full bg-teal"
                        style={{ width: `${twin.sustainability.score}%` }}
                      />
                    </div>
                    <span className="font-mono text-xs text-ivory">{twin.sustainability.score}/100</span>
                  </div>
                  <p className="mt-2 text-xs text-mist">{twin.sustainability.notes}</p>
                </div>

                <div className="rounded-md border border-line bg-panel-2 p-4">
                  <p className="font-mono text-[11px] tracking-[0.2em] text-mist uppercase">Confidence Score</p>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel">
                      <div className="h-full rounded-full bg-amber" style={{ width: `${twin.confidence}%` }} />
                    </div>
                    <span className="font-mono text-xs text-ivory">{twin.confidence}%</span>
                  </div>
                  <p className="mt-2 text-xs text-mist">
                    Extraction confidence based on source clarity and field completeness.
                  </p>
                </div>
              </div>

              <div className="mt-8 flex items-center gap-2 border-t border-line pt-5">
                <CheckIcon className="h-4 w-4 text-teal" />
                <p className="font-mono text-xs text-mist">
                  Source: {source || "SOURCE"} → structured model (demo)
                </p>
              </div>
            </div>
          ) : (
            <div className="relative border border-line bg-panel/80 p-6 backdrop-blur-sm sm:p-8">
              <CornerBrackets />

              {buildState === "processing" && (
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                  <div className="animate-scan absolute inset-x-0 h-24 bg-gradient-to-b from-transparent via-teal/15 to-transparent" />
                </div>
              )}

              {buildState === "processing" ? (
                <div className="py-2">
                  <span className="font-mono text-[11px] tracking-[0.2em] text-teal uppercase">
                    Building Digital Twin
                  </span>
                  <p className="mt-1 text-xs text-mist">{(fileName ?? identifyValue) || "SOURCE"}</p>

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
                            mode === m ? "bg-teal text-ink" : "text-mist hover:text-ivory"
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
                      placeholder={mode === "sku" ? "e.g. SKU-4471-BLK" : "e.g. https://brand.com/product/..."}
                      className="mt-3 w-full rounded-md border border-line bg-panel-2 px-4 py-3 font-mono text-sm text-ivory placeholder-mist/60 outline-none transition focus:border-teal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
                    />
                  </div>

                  <div className="my-6 flex items-center gap-3">
                    <div className="h-px flex-1 bg-line" />
                    <span className="font-mono text-[10px] tracking-[0.2em] text-mist">OR</span>
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
                        isDragging ? "border-teal bg-teal/5" : "border-line bg-panel-2"
                      }`}
                    >
                      {fileName ? (
                        <div className="flex w-full items-center justify-between gap-3 rounded-md border border-line bg-panel px-3 py-2">
                          <div className="flex min-w-0 items-center gap-2 text-ivory">
                            <FileIcon />
                            <span className="truncate font-mono text-xs">{fileName}</span>
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
                          <p className="text-xs text-mist">Drop a PDF, or</p>
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
                            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
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
          )}

          {buildState !== "done" && (
            <div className="mt-4 flex items-center justify-between font-mono text-[10px] tracking-wide text-mist uppercase">
              <span className="flex items-center gap-1.5">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    buildState === "processing" ? "bg-amber" : "bg-teal shadow-[0_0_6px_rgba(79,224,196,0.8)]"
                  }`}
                />
                {statusText}
              </span>
              <span>engine v0.1 · local</span>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
