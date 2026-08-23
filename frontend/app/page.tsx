"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import KnowledgeGraphViewer from "./KnowledgeGraphViewer";

const getApiBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window === "undefined") return "http://localhost:8000";
  const hostname = window.location.hostname;
  if (hostname.includes("github.dev")) {
    const codespaceHost = hostname.replace("-3000", "-8000");
    return `https://${codespaceHost}`;
  }
  return "http://localhost:8000";
};

type IdentifyMode = "sku" | "url";
type BuildState = "idle" | "processing" | "done" | "evidence";
type StageStatus = "pending" | "active" | "completed";
type ReviewAction = "none" | "approved" | "review";

const STAGES = [
  "Validate source",
  "Extract specifications",
  "Generate product twin",
];

const MOCK_CATEGORIES = [
  "Consumer Electronics",
  "Home Appliances",
  "Industrial Hardware",
  "Furniture",
];

const MOCK_MATERIALS = [
  "Anodized Aluminum",
  "ABS Polymer",
  "Tempered Glass",
  "Recycled Steel",
];

const MOCK_CERTS = ["CE", "RoHS", "FCC", "ISO 9001"];

const EVIDENCE = {
  product: "ABB ACS580-01-046A-4",
  attribute: "IP Rating",
  resolvedValue: "IP21",
  confidence: 71,
  conflict: true,
  analysis:
    "Manufacturer Datasheet and Distributor A agree on IP21. Distributor B reports IP55, which does not match. Possible product variant mismatch — Distributor B may be listing a sealed/enclosure variant of this drive.",
  sources: [
    {
      name: "Manufacturer Datasheet",
      detail: "Page 14",
      value: "IP21",
      trust: "High",
      agrees: true,
    },
    {
      name: "Distributor A",
      detail: "Product listing",
      value: "IP21",
      trust: "Medium",
      agrees: true,
    },
    {
      name: "Distributor B",
      detail: "Product listing",
      value: "IP55",
      trust: "Medium",
      agrees: false,
    },
  ],
};

function seedFromString(input: string) {
  let hash = 0;

  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }

  return hash;
}

function buildMockTwin(source: string) {
  // Temporary mock returning the *real* Shared JSON Contract shape
  return {
    product_id: "ACS580-01-046A-4",
    manufacturer: "ABB",
    category: "Variable Frequency Drive",
    attributes: {
      voltage: { value: "380-480", unit: "V", confidence: 0.98, status: "verified" },
      current: { value: 46, unit: "A", confidence: 0.97, status: "verified" },
      power: { value: 22, unit: "kW", confidence: 0.96, status: "verified" },
      weight: { value: 18.2, unit: "kg", confidence: 0.94, status: "verified" },
      ip_rating: { value: "IP21", unit: "", confidence: 0.71, status: "conflict" }
    },
    conflicts: [],
    sources: [],
    review_required: false,
    confidence: 94
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

function BoxIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-10 w-10"
    >
      <path d="M21 8 12 3 3 8l9 5 9-5Z" />
      <path d="M3 8v8l9 5 9-5V8" />
      <path d="M12 13v8" />
    </svg>
  );
}

function AlertIcon({ className = "h-4 w-4" }: { className?: string }) {
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
      <path d="M12 9v4" />
      <path d="M10.3 3.6 1.8 18a1.8 1.8 0 0 0 1.5 2.7h17.4a1.8 1.8 0 0 0 1.5-2.7L13.7 3.6a1.8 1.8 0 0 0-3.4 0Z" />
      <path d="M12 16.2h.01" />
    </svg>
  );
}

function XCircleIcon({ className = "h-4 w-4" }: { className?: string }) {
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
      <circle cx="12" cy="12" r="9" />
      <path d="M15 9l-6 6" />
      <path d="M9 9l6 6" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M4 19h16" />
    </svg>
  );
}

export default function Home() {
  const [mode, setMode] = useState<IdentifyMode>("sku");
  const [identifyValue, setIdentifyValue] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileObj, setFileObj] = useState<File | null>(null);
  const [buildState, setBuildState] = useState<BuildState>("idle");
  const [activeStage, setActiveStage] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [source, setSource] = useState("");
  const [reviewAction, setReviewAction] =
    useState<ReviewAction>("none");
  const [reviewNotes, setReviewNotes] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const canBuild =
    (identifyValue.trim().length > 0 || fileName !== null) &&
    buildState === "idle";

  const [twinData, setTwinData] = useState<any>(null);
  const [showGraph, setShowGraph] = useState(false);
  const twin = useMemo(() => twinData || buildMockTwin(source), [source, twinData]);

  function handleFile(file: File | null) {
    if (file && file.type === "application/pdf") {
      setFileName(file.name);
      setFileObj(file);
    } else {
      setFileName(null);
      setFileObj(null);
    }
  }

  async function handleBuild() {
    if (!canBuild) return;

    const targetSource = fileName ?? identifyValue;
    setSource(targetSource);
    setActiveStage(0);
    setBuildState("processing");
    setReviewAction("none");
    setReviewNotes("");

    // Wire up to Person 3's real API endpoint!
    try {
      let productId = `PT-${Math.floor(1000 + Math.random() * 9000)}`;

      if (fileObj) {
        // 1. Upload Document
        const formData = new FormData();
        formData.append("file", fileObj);
        formData.append("product_id", productId);

        const uploadRes = await fetch(`${getApiBaseUrl()}/document/upload`, {
          method: "POST",
          body: formData
        });

        if (!uploadRes.ok) throw new Error("Upload failed");

        setActiveStage(1);
        // 2. Analyze Product
        const analyzeRes = await fetch(`${getApiBaseUrl()}/product/analyze?product_id=${productId}&source_name=${encodeURIComponent(fileName!)}`, {
          method: "POST"
        });
        if (!analyzeRes.ok) throw new Error("Analyze failed");
      } else {
        setActiveStage(1);
        // 2. Analyze URL/SKU
        const analyzeRes = await fetch(`${getApiBaseUrl()}/product/analyze?product_id=${productId}&source_name=${encodeURIComponent(identifyValue)}&url=${encodeURIComponent(identifyValue)}`, {
          method: "POST"
        });
        if (!analyzeRes.ok) throw new Error("Analyze URL failed. Ensure the link is valid and accessible.");
      }

      setActiveStage(2);
      // 3. Get full Twin data
      const getRes = await fetch(`${getApiBaseUrl()}/product/${productId}`);
      if (getRes.ok) {
        const data = await getRes.json();
        setTwinData(data);
        setActiveStage(3);
        setTimeout(() => setBuildState("done"), 450);
      } else {
        throw new Error("Unable to fetch twin data.");
      }
    } catch (e: any) {
      console.error(e);
      alert("Error: " + (e.message || "Failed to analyze. Please check your link or file."));
      setBuildState("idle");
    }
  }

  function reset() {
    setBuildState("idle");
    setActiveStage(0);
    setIdentifyValue("");
    setFileName(null);
    setReviewAction("none");
    setReviewNotes("");
  }

  // Removed automatic timer to sync stages with actual backend fetch hook

  function stageStatus(index: number): StageStatus {
    if (index < activeStage) return "completed";

    if (
      index === activeStage &&
      buildState === "processing"
    ) {
      return "active";
    }

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

  const containerWidth =
    buildState === "done" || buildState === "evidence"
      ? "max-w-5xl"
      : "max-w-xl";

  function downloadFile(
    content: string,
    fileName: string,
    mimeType: string
  ) {
    const blob = new Blob([content], {
      type: mimeType,
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = fileName;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  }

  function exportJSON() {
    const exportData = {
      product: twin.manufacturer,
      sku: twin.product_id,
      category: twin.category,
      source: source || "PRODUCTTWIN-DEMO",
      confidence: twin.confidence,
      attributes: twin.attributes,
      conflicts: twin.conflicts,
      sources: twin.sources,
      review_required: twin.review_required,
      evidenceReview: {
        product: EVIDENCE.product,
        attribute: EVIDENCE.attribute,
        resolvedValue: EVIDENCE.resolvedValue,
        confidence: EVIDENCE.confidence,
        conflictDetected: EVIDENCE.conflict,
        sources: EVIDENCE.sources,
        reviewerDecision:
          reviewAction === "approved"
            ? "Approved"
            : reviewAction === "review"
              ? "Sent to Review"
              : "Pending",
        reviewerNotes: reviewNotes || "No reviewer notes added.",
      },
      generatedAt: new Date().toISOString(),
      environment: "Local Demo",
    };

    downloadFile(
      JSON.stringify(exportData, null, 2),
      `producttwin-${twin.sku}.json`,
      "application/json"
    );
  }

  function exportCSV() {
    const baseHeaders = [
      "MFR URL", "Ref URL 1", "Ref URL 2", "Ref URL 3", "Ref URL 4", "Ref URL 5",
      "PART_NUMBER", "Dept", "Class", "Fine", "SKU - MY_PART_NUMBER", "Mfg_Part_Num",
      "Part_Desc", "E1_Brand", "Unilog_Brand", "DIB_Brand", "Part_Manuf",
      "MANUFACTURER_NAME", "BRAND_NAME", "TRADE_NAME", "MANUFACTURER_PART_NUMBER",
      "ALTERNATE_PART_NUMBER", "Classpath", "MOBILE_DESC", "INVOICE_DESC", "SHORT_DESC",
      "LONG_DESC1", "RETAIL_DESC", "MARKETING_DESCRIPTION"
    ];
    for (let i = 1; i <= 20; i++) baseHeaders.push(`ITEM_FEATURES_${i}`);
    baseHeaders.push("With", "Standard/Approvals", "Prop 65", "Application", "Includes", "Product Name");

    for (let i = 1; i <= 50; i++) {
      baseHeaders.push(`ATTRIBUTE_LABEL ${i}`, `ATTRIBUTE_VALUE ${i}`, `ATTRIBUTE_UOM ${i}`);
    }

    const trailingHeaders = [
      "UPC", "EAN", "GTIN", "UNSPSC", "Warranty", "List Price", "Selling Qty", "Selling UOM",
      "Standard Packaging Information", "LENGTH", "LENGTH_UOM", "HEIGHT", "HEIGHT_UOM",
      "WIDTH", "WIDTH_UOM", "WEIGHT", "WEIGHT_UOM", "VOLUME", "VOLUME_UOM", "Product Image",
      "Alternate Image 1", "Alternate Image 2", "Alternate Image 3", "Alternate Image 4",
      "SDS", "SDS_1", "Warranty Information", "Catalog", "Specification Sheet",
      "Instruction/Installation Manual", "Service Manual", "Owners/User Manual", "Line Drawing",
      "MTR", "RoHS", "Full Engineering Drawing", "Energy Star Guide", "Technical Bulletin",
      "Submittal", "Compatibility Chart", "Size Chart", "Product Label/Insert", "Video Link",
      "Video Link 1", "Country Of Origin", "Discontinued", "Actual Image (Yes/No)"
    ];

    const allHeaders = [...baseHeaders, ...trailingHeaders];
    const rowData: Record<string, any> = {};

    rowData["MANUFACTURER_NAME"] = twin.manufacturer || "";
    rowData["Mfg_Part_Num"] = twin.product_id || "";
    rowData["MANUFACTURER_PART_NUMBER"] = twin.product_id || "";
    rowData["Product Name"] = twin.category || "";
    rowData["MFR URL"] = source || "";

    let attrIndex = 1;
    if (twin.attributes) {
      for (const [key, attrObj] of Object.entries(twin.attributes)) {
        if (attrIndex > 50) break;
        rowData[`ATTRIBUTE_LABEL ${attrIndex}`] = key.replace(/_/g, " ");
        rowData[`ATTRIBUTE_VALUE ${attrIndex}`] = (attrObj as any).value || "";
        rowData[`ATTRIBUTE_UOM ${attrIndex}`] = (attrObj as any).unit || "";
        attrIndex++;
      }
    }

    const csvContent = [
      allHeaders.map(h => `"${h}"`).join(","),
      allHeaders.map(h => {
        const val = rowData[h] !== undefined ? String(rowData[h]) : "";
        return `"${val.replace(/"/g, '""')}"`;
      }).join(",")
    ].join("\\n");

    downloadFile(csvContent, `producttwin-${twin.product_id || "export"}.csv`, "text/csv;charset=utf-8");
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-ink">
      <div className="bg-blueprint-grid animate-blueprint-pulse pointer-events-none absolute inset-0" />

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink via-transparent to-ink" />

      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[36rem] -translate-x-1/2 rounded-full bg-teal/10 blur-3xl" />

      <main className="relative flex min-h-screen flex-col items-center px-6 py-14 sm:py-20">
        {buildState !== "done" &&
          buildState !== "evidence" && (
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
                Feed in a SKU, a product URL, or a spec sheet. We build a
                structured digital twin — instantly.
              </p>
            </div>
          )}

        <div
          className={`animate-fade-up relative mt-12 w-full ${containerWidth} transition-all duration-300`}
        >
          {buildState === "evidence" ? (
            <div className="relative border border-line bg-panel/80 p-6 backdrop-blur-sm sm:p-8">
              <CornerBrackets />

              {/* Evidence Header */}
              <div className="flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-display text-lg font-semibold text-ivory">
                      Product<span className="text-teal">Twin</span>
                    </span>

                    <span className="rounded-full border border-teal/40 bg-teal/10 px-2 py-0.5 font-mono text-[10px] tracking-wide text-teal uppercase">
                      Evidence Viewer
                    </span>
                  </div>

                  <p className="mt-1 font-mono text-[10px] tracking-wide text-mist uppercase">
                    Local · Demo Data · Not Connected To Live Source
                  </p>
                </div>

                <button
                  onClick={() => setBuildState("done")}
                  className="self-start rounded-md border border-line bg-panel-2 px-3 py-1.5 font-mono text-xs tracking-wide text-ivory uppercase transition hover:border-teal hover:text-teal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal sm:self-auto"
                >
                  Back to Product Intelligence
                </button>
              </div>

              {/* Product / Attribute */}
              <div className="mt-6 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-mono text-[10px] tracking-[0.2em] text-mist uppercase">
                    Product
                  </p>

                  <p className="mt-1 font-display text-lg font-medium text-ivory">
                    {EVIDENCE.product}
                  </p>
                </div>

                <div className="sm:text-right">
                  <p className="font-mono text-[10px] tracking-[0.2em] text-mist uppercase">
                    Attribute Under Review
                  </p>

                  <p className="mt-1 font-mono text-sm text-teal">
                    {EVIDENCE.attribute}
                  </p>
                </div>
              </div>

              {/* Resolution */}
              <div className="mt-6 rounded-md border border-amber/40 bg-amber/5 p-5">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <span className="font-display text-5xl font-semibold text-ivory">
                      {EVIDENCE.resolvedValue}
                    </span>

                    <span className="flex items-center gap-1.5 rounded-full border border-amber/50 bg-amber/10 px-2.5 py-1 font-mono text-[10px] tracking-wide text-amber uppercase">
                      <AlertIcon className="h-3.5 w-3.5" />
                      Conflict Detected
                    </span>
                  </div>

                  <div className="min-w-[10rem]">
                    <div className="flex items-center justify-between font-mono text-[10px] tracking-wide text-mist uppercase">
                      <span>Confidence</span>

                      <span className="text-ivory">
                        {EVIDENCE.confidence}%
                      </span>
                    </div>

                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-panel">
                      <div
                        className="h-full rounded-full bg-amber"
                        style={{
                          width: `${EVIDENCE.confidence}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Evidence Sources */}
              <div className="mt-8">
                <span className="font-mono text-[11px] tracking-[0.2em] text-mist uppercase">
                  Evidence Sources
                </span>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {EVIDENCE.sources.map((s) => (
                    <div
                      key={s.name}
                      className={`rounded-md border p-4 ${s.agrees
                          ? "border-line bg-panel-2"
                          : "border-amber/50 bg-amber/5"
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-mono text-[10px] tracking-wide text-mist uppercase">
                          {s.detail}
                        </p>

                        {s.agrees ? (
                          <CheckIcon className="h-4 w-4 text-teal" />
                        ) : (
                          <XCircleIcon className="h-4 w-4 text-amber" />
                        )}
                      </div>

                      <p className="mt-2 text-sm font-medium text-ivory">
                        {s.name}
                      </p>

                      <p
                        className={`mt-3 font-display text-2xl font-semibold ${s.agrees
                            ? "text-ivory"
                            : "text-amber"
                          }`}
                      >
                        {s.value}
                      </p>

                      <p className="mt-2 font-mono text-[10px] tracking-wide text-mist uppercase">
                        Trust:{" "}
                        <span className="text-ivory">
                          {s.trust}
                        </span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Conflict Analysis */}
              <div className="mt-8 rounded-md border border-line bg-panel-2 p-4">
                <div className="flex items-center gap-2">
                  <AlertIcon className="h-4 w-4 text-amber" />

                  <span className="font-mono text-[11px] tracking-[0.2em] text-mist uppercase">
                    Conflict Analysis
                  </span>
                </div>

                <p className="mt-3 text-sm text-ivory">
                  Manufacturer Datasheet and Distributor A agree on{" "}
                  <span className="text-teal">IP21</span>.
                  Distributor B reports{" "}
                  <span className="text-amber">IP55</span>, which
                  does not match.
                </p>

                <p className="mt-2 text-sm text-mist">
                  {EVIDENCE.analysis}
                </p>
              </div>

              {/* HUMAN REVIEW */}
              <div className="mt-8 rounded-md border border-teal/30 bg-teal/5 p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] tracking-[0.2em] text-teal uppercase">
                        Human Review
                      </span>

                      <span
                        className={`rounded-full border px-2 py-0.5 font-mono text-[9px] tracking-wide uppercase ${reviewAction === "approved"
                            ? "border-teal/50 bg-teal/10 text-teal"
                            : reviewAction === "review"
                              ? "border-amber/50 bg-amber/10 text-amber"
                              : "border-line bg-panel-2 text-mist"
                          }`}
                      >
                        {reviewAction === "approved"
                          ? "Approved"
                          : reviewAction === "review"
                            ? "Manual Review"
                            : "Pending"}
                      </span>
                    </div>

                    <p className="mt-2 max-w-2xl text-sm text-mist">
                      Review the conflicting evidence before accepting
                      the resolved attribute value.
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_16rem]">
                  <div>
                    <label
                      htmlFor="review-notes"
                      className="font-mono text-[10px] tracking-[0.2em] text-mist uppercase"
                    >
                      Reviewer Notes
                    </label>

                    <textarea
                      id="review-notes"
                      value={reviewNotes}
                      onChange={(e) =>
                        setReviewNotes(e.target.value)
                      }
                      placeholder="Add a short explanation for the review decision..."
                      rows={4}
                      className="mt-2 w-full resize-none rounded-md border border-line bg-panel-2 px-3 py-2.5 text-sm text-ivory placeholder-mist/60 outline-none transition focus:border-teal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <span className="font-mono text-[10px] tracking-[0.2em] text-mist uppercase">
                      Decision
                    </span>

                    <button
                      type="button"
                      onClick={async () => {
                        setReviewAction("approved");
                        try {
                          await fetch(`${getApiBaseUrl()}/review/${twin.product_id}`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ attribute_name: EVIDENCE.attribute, approved_value: EVIDENCE.resolvedValue, notes: reviewNotes })
                          });
                        } catch (e) { }
                      }}
                      className={`rounded-md border px-4 py-2.5 font-mono text-xs tracking-wide uppercase transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal ${reviewAction === "approved"
                          ? "border-teal bg-teal text-ink"
                          : "border-line bg-panel-2 text-ivory hover:border-teal hover:text-teal"
                        }`}
                    >
                      {reviewAction === "approved"
                        ? "Approved ✓"
                        : "Approve Evidence"}
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        setReviewAction("review");
                        try {
                          await fetch(`${getApiBaseUrl()}/review/${twin.product_id}`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ attribute_name: EVIDENCE.attribute, approved_value: "REVIEW", notes: reviewNotes })
                          });
                        } catch (e) { }
                      }}
                      className={`rounded-md border px-4 py-2.5 font-mono text-xs tracking-wide uppercase transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal ${reviewAction === "review"
                          ? "border-amber bg-amber text-ink"
                          : "border-line bg-panel-2 text-ivory hover:border-amber hover:text-amber"
                        }`}
                    >
                      {reviewAction === "review"
                        ? "Sent to Review ✓"
                        : "Flag for Review"}
                    </button>
                  </div>
                </div>

                {reviewAction !== "none" && (
                  <div className="mt-4 flex items-center gap-2 border-t border-line pt-4">
                    {reviewAction === "approved" ? (
                      <CheckIcon className="h-4 w-4 text-teal" />
                    ) : (
                      <AlertIcon className="h-4 w-4 text-amber" />
                    )}

                    <p className="font-mono text-[10px] tracking-wide text-mist uppercase">
                      {reviewAction === "approved"
                        ? "Evidence approved locally — demo status updated."
                        : "Evidence flagged for manual review — demo status updated."}
                    </p>
                  </div>
                )}
              </div>

              {/* EXPORT */}
              <div className="mt-6 rounded-md border border-line bg-panel-2 p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-mono text-[11px] tracking-[0.2em] text-mist uppercase">
                      Export Review Record
                    </p>

                    <p className="mt-1 text-xs text-mist">
                      Download the generated twin and human-review decision
                      for downstream workflows.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={exportJSON}
                      className="flex items-center gap-2 rounded-md border border-line bg-panel px-3 py-2 font-mono text-xs tracking-wide text-ivory uppercase transition hover:border-teal hover:text-teal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
                    >
                      <DownloadIcon />
                      Export JSON
                    </button>

                    <button
                      type="button"
                      onClick={exportCSV}
                      className="flex items-center gap-2 rounded-md border border-line bg-panel px-3 py-2 font-mono text-xs tracking-wide text-ivory uppercase transition hover:border-teal hover:text-teal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
                    >
                      <DownloadIcon />
                      Export CSV
                    </button>
                  </div>
                </div>
              </div>

              {/* Bottom actions */}
              <div className="mt-8 flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <p className="font-mono text-[10px] tracking-wide text-mist uppercase">
                  Review state is stored locally for this demo session.
                </p>

                <button
                  onClick={reset}
                  className="rounded-md border border-line bg-panel-2 px-4 py-2 font-mono text-xs tracking-wide text-mist uppercase transition hover:border-teal hover:text-teal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
                >
                  Build another
                </button>
              </div>
            </div>
          ) : buildState === "done" ? (
            <div className="relative border border-line bg-panel/80 p-6 backdrop-blur-sm sm:p-8">
              <CornerBrackets />

              {/* Header */}
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

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setBuildState("evidence")}
                    className="rounded-md border border-line bg-panel-2 px-3 py-1.5 font-mono text-xs tracking-wide text-ivory uppercase transition hover:border-teal hover:text-teal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
                  >
                    View Evidence Trail
                  </button>

                  <button
                    onClick={() => setShowGraph(true)}
                    className="flex items-center gap-2 rounded-md border border-line bg-panel-2 px-3 py-1.5 font-mono text-xs tracking-wide text-ivory uppercase transition hover:border-teal hover:text-teal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
                    View Knowledge Graph
                  </button>

                  <button
                    onClick={exportJSON}
                    className="flex items-center gap-2 rounded-md border border-line bg-panel-2 px-3 py-1.5 font-mono text-xs tracking-wide text-ivory uppercase transition hover:border-teal hover:text-teal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
                  >
                    <DownloadIcon />
                    Export JSON
                  </button>

                  <button
                    onClick={reset}
                    className="rounded-md border border-line bg-panel-2 px-3 py-1.5 font-mono text-xs tracking-wide text-ivory uppercase transition hover:border-teal hover:text-teal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
                  >
                    Build another
                  </button>
                </div>
              </div>

              {/* Product Summary */}
              <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-[9rem_1fr]">
                <div className="flex h-36 w-full items-center justify-center rounded-md border border-dashed border-line bg-panel-2 text-mist sm:w-36">
                  <BoxIcon />
                </div>

                <div>
                  <h2 className="font-display text-2xl font-semibold text-ivory">
                    {twin.manufacturer}
                  </h2>

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-mist">
                    <span>
                      Product ID{" "}
                      <span className="text-ivory">
                        {twin.product_id}
                      </span>
                    </span>

                    <span className="h-1 w-1 rounded-full bg-line" />

                    <span>
                      Category{" "}
                      <span className="text-ivory">
                        {twin.category}
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Specifications */}
              <div className="mt-8">
                <span className="font-mono text-[11px] tracking-[0.2em] text-mist uppercase">
                  Key Specifications
                </span>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(twin.attributes).map(([key, attr]: [string, any]) => (
                    <div
                      key={key}
                      className="rounded-md border border-line bg-panel-2 px-4 py-3"
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-mono text-[10px] tracking-wide text-mist uppercase">
                          {key.replace('_', ' ')}
                        </p>
                        <span className={`font-mono text-[9px] px-1.5 py-0.5 rounded border ${attr.status === 'verified' ? 'text-teal border-teal/30 bg-teal/5' : 'text-amber border-amber/30 bg-amber/5'}`}>{attr.status}</span>
                      </div>

                      <p className="mt-2 text-lg text-ivory">
                        {attr.value} <span className="text-sm text-mist">{attr.unit}</span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Twin Information */}
              <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-md border border-line bg-panel-2 p-4">
                  <p className="font-mono text-[11px] tracking-[0.2em] text-mist uppercase">
                    Confidence Score
                  </p>

                  <div className="mt-3 flex items-center gap-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel">
                      <div
                        className="h-full rounded-full bg-teal"
                        style={{
                          width: `${twin.confidence}%`,
                        }}
                      />
                    </div>

                    <span className="font-mono text-xs text-ivory">
                      {twin.confidence}%
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-mist">
                    Extraction confidence based on source clarity and field completeness.
                  </p>
                </div>
              </div>

              {/* Source */}
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

                  <p className="mt-1 text-xs text-mist">
                    {(fileName ?? identifyValue) || "SOURCE"}
                  </p>

                  <div className="mt-6 h-1 w-full overflow-hidden rounded-full bg-panel-2">
                    <div
                      className="h-full rounded-full bg-teal transition-all duration-500 ease-out"
                      style={{
                        width: `${progressPercent}%`,
                      }}
                    />
                  </div>

                  <ul className="mt-6 flex flex-col gap-3">
                    {STAGES.map((label, i) => {
                      const status = stageStatus(i);

                      return (
                        <li
                          key={label}
                          className={`flex items-center gap-3 rounded-md border px-3 py-2.5 transition ${status === "active"
                              ? "border-teal/50 bg-teal/5"
                              : status === "completed"
                                ? "border-line bg-panel-2"
                                : "border-line/60 bg-panel-2/40"
                            }`}
                        >
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-[10px] ${status === "completed"
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
                            className={`font-mono text-xs tracking-wide uppercase ${status === "pending"
                                ? "text-mist"
                                : "text-ivory"
                              }`}
                          >
                            {String(i + 1).padStart(2, "0")}{" "}
                            {label}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : (
                <>
                  {/* Identify */}
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
                          className={`rounded px-3 py-1.5 font-mono text-xs tracking-wide uppercase transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal ${mode === m
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
                      onChange={(e) =>
                        setIdentifyValue(e.target.value)
                      }
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

                  {/* Upload */}
                  <div>
                    <span className="font-mono text-[11px] tracking-[0.2em] text-mist uppercase">
                      02 — Upload spec sheet
                    </span>

                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragging(true);
                      }}
                      onDragLeave={() =>
                        setIsDragging(false)
                      }
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDragging(false);

                        handleFile(
                          e.dataTransfer.files?.[0] ?? null
                        );
                      }}
                      className={`mt-3 flex flex-col items-center justify-center gap-2 rounded-md border border-dashed px-4 py-6 text-center transition ${isDragging
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
                            onClick={() =>
                              setFileName(null)
                            }
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
                            onClick={() =>
                              fileInputRef.current?.click()
                            }
                            className="rounded-md border border-line bg-panel px-3 py-1.5 font-mono text-xs tracking-wide text-ivory uppercase transition hover:border-teal hover:text-teal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
                          >
                            Upload PDF
                          </button>

                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="application/pdf"
                            onChange={(e) =>
                              handleFile(
                                e.target.files?.[0] ?? null
                              )
                            }
                            className="hidden"
                          />
                        </>
                      )}
                    </div>
                  </div>

                  {/* Build */}
                  <button
                    type="button"
                    disabled={!canBuild}
                    onClick={handleBuild}
                    className={`mt-7 flex w-full items-center justify-center gap-2 rounded-md py-3.5 font-display text-sm font-semibold tracking-[0.08em] uppercase transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal ${canBuild
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

          {buildState !== "done" &&
            buildState !== "evidence" && (
              <div className="mt-4 flex items-center justify-between font-mono text-[10px] tracking-wide text-mist uppercase">
                <span className="flex items-center gap-1.5">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${buildState === "processing"
                        ? "bg-amber"
                        : "bg-teal shadow-[0_0_6px_rgba(79,224,196,0.8)]"
                      }`}
                  />

                  {statusText}
                </span>

                <span>engine v0.1 · local</span>
              </div>
            )}
        </div>
      </main>

      {showGraph && (
        <KnowledgeGraphViewer
          productId={twin.product_id}
          onClose={() => setShowGraph(false)}
        />
      )}
    </div>
  );
}