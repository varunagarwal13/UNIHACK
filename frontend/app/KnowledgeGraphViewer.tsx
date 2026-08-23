"use client";

import { useEffect, useRef, useState } from "react";

interface Node {
  id: string;
  group: "Product" | "Source" | "Attribute" | "Evidence";
  label: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
  [key: string]: any;
}

interface Edge {
  source: string;
  target: string;
  relationship: string;
}

interface GraphData {
  nodes: Node[];
  edges: Edge[];
  metrics: {
    node_count: number;
    edge_count: number;
  };
}

interface ViewerProps {
  productId: string;
  onClose: () => void;
}

const getApiBase = () => {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window === "undefined") return "http://localhost:8000";
  const hostname = window.location.hostname;
  if (hostname.includes("github.dev") || hostname.includes("localhost")) {
    return "http://localhost:8000";
  }
  return "https://unihack-backend.vercel.app";
};

export default function KnowledgeGraphViewer({ productId, onClose }: ViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);

  // Pan & Zoom state
  const transformRef = useRef({ x: 0, y: 0, k: 1 });
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const activeDragNodeRef = useRef<Node | null>(null);
  const hoveredNodeRef = useRef<Node | null>(null);

  // Local mutable copy of nodes/edges for simulation
  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);

  // Fetch graph payload
  useEffect(() => {
    let active = true;
    async function loadGraph() {
      try {
        const apiBase = getApiBase();
        const res = await fetch(`${apiBase}/product/${productId}/graph`);
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const graphData = await res.json();

        if (active) {
          // Initialize positions on a circle to avoid overlaps
          const width = 800;
          const height = 500;
          const nodes = graphData.nodes.map((n: Node, index: number) => {
            const angle = (index / graphData.nodes.length) * Math.PI * 2;
            const radius = 100 + Math.random() * 80;
            return {
              ...n,
              x: width / 2 + Math.cos(angle) * radius,
              y: height / 2 + Math.sin(angle) * radius,
              vx: 0,
              vy: 0,
              fx: null,
              fy: null,
            };
          });

          nodesRef.current = nodes;
          edgesRef.current = graphData.edges;
          setData({ ...graphData, nodes });
          setLoading(false);
        }
      } catch (err: any) {
        if (active) {
          setError(err.message || "Failed to load knowledge graph");
          setLoading(false);
        }
      }
    }
    loadGraph();
    return () => {
      active = false;
    };
  }, [productId]);

  // Simulation and Drawing loop
  useEffect(() => {
    if (!data || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animFrameId: number;

    const tick = () => {
      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      const width = canvas.width;
      const height = canvas.height;

      // 1. Force Simulation Calculations (if playing)
      if (isPlaying) {
        const kRepel = 400;
        const kAttract = 0.04;
        const kCenter = 0.01;
        const targetDist = 70;

        // Repulsion
        for (let i = 0; i < nodes.length; i++) {
          const n1 = nodes[i];
          for (let j = i + 1; j < nodes.length; j++) {
            const n2 = nodes[j];
            const dx = (n1.x || 0) - (n2.x || 0);
            const dy = (n1.y || 0) - (n2.y || 0);
            const distSq = dx * dx + dy * dy || 1;
            const dist = Math.sqrt(distSq);

            const force = kRepel / distSq;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            if (n1.fx === null) {
              n1.vx = (n1.vx || 0) + fx;
              n1.vy = (n1.vy || 0) + fy;
            }
            if (n2.fx === null) {
              n2.vx = (n2.vx || 0) - fx;
              n2.vy = (n2.vy || 0) - fy;
            }
          }
        }

        // Attraction
        edges.forEach((edge) => {
          const sNode = nodes.find((n) => n.id === edge.source);
          const tNode = nodes.find((n) => n.id === edge.target);
          if (!sNode || !tNode) return;

          const dx = (sNode.x || 0) - (tNode.x || 0);
          const dy = (sNode.y || 0) - (tNode.y || 0);
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = (dist - targetDist) * kAttract;

          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          if (sNode.fx === null) {
            sNode.vx = (sNode.vx || 0) - fx;
            sNode.vy = (sNode.vy || 0) - fy;
          }
          if (tNode.fx === null) {
            tNode.vx = (tNode.vx || 0) + fx;
            tNode.vy = (tNode.vy || 0) + fy;
          }
        });

        // Center force and update positions
        nodes.forEach((n) => {
          if (n.fx !== null && n.fx !== undefined) {
            n.x = n.fx;
            n.y = n.fy || 0;
            n.vx = 0;
            n.vy = 0;
          } else {
            n.vx = ((n.vx || 0) + (width / 2 - (n.x || 0)) * kCenter) * 0.85;
            n.vy = ((n.vy || 0) + (height / 2 - (n.y || 0)) * kCenter) * 0.85;
            n.x = (n.x || 0) + n.vx;
            n.y = (n.y || 0) + n.vy;
          }
        });
      }

      // 2. Render Canvas
      ctx.clearRect(0, 0, width, height);

      ctx.save();
      const transform = transformRef.current;
      ctx.translate(transform.x, transform.y);
      ctx.scale(transform.k, transform.k);

      // Draw Edges
      edges.forEach((edge) => {
        const sNode = nodes.find((n) => n.id === edge.source);
        const tNode = nodes.find((n) => n.id === edge.target);
        if (!sNode || !tNode) return;

        // Dim if a node is hovered and isn't part of this edge
        const hovered = hoveredNodeRef.current;
        let opacity = 0.35;
        if (hovered) {
          if (edge.source === hovered.id || edge.target === hovered.id) {
            opacity = 0.9;
          } else {
            opacity = 0.1;
          }
        }

        ctx.strokeStyle = `rgba(165, 180, 252, ${opacity})`; // Violet Indigo
        ctx.lineWidth = hovered && (edge.source === hovered.id || edge.target === hovered.id) ? 2 : 1.2;
        ctx.setLineDash(edge.relationship === "SUPPORTED_BY" ? [4, 4] : []);
        ctx.beginPath();
        ctx.moveTo(sNode.x || 0, sNode.y || 0);
        ctx.lineTo(tNode.x || 0, tNode.y || 0);
        ctx.stroke();
        ctx.setLineDash([]);
      });

      // Draw Nodes
      nodes.forEach((n) => {
        const isHovered = hoveredNodeRef.current?.id === n.id;
        const isSelected = selectedNode?.id === n.id;
        const hovered = hoveredNodeRef.current;

        let opacity = 1.0;
        if (hovered) {
          // Check if n is connected to hovered node
          const isConnected = edges.some(
            (e) => (e.source === hovered.id && e.target === n.id) ||
              (e.target === hovered.id && e.source === n.id)
          );
          if (!isHovered && !isConnected) {
            opacity = 0.25;
          }
        }

        const size = n.group === "Product" ? 22 : n.group === "Source" ? 16 : n.group === "Attribute" ? 14 : 10;
        const colors = {
          Product: `rgba(79, 224, 196, ${opacity})`,   // Teal
          Source: `rgba(245, 158, 11, ${opacity})`,    // Amber
          Attribute: `rgba(139, 92, 246, ${opacity})`, // Violet
          Evidence: `rgba(59, 130, 246, ${opacity})`   // Blue
        };

        ctx.beginPath();
        ctx.arc(n.x || 0, n.y || 0, size, 0, Math.PI * 2);
        ctx.fillStyle = colors[n.group];
        ctx.fill();

        // Node Glow / Stroke
        ctx.lineWidth = isHovered || isSelected ? 3.5 : 1.5;
        ctx.strokeStyle = isSelected
          ? `rgba(255, 255, 255, ${opacity})`
          : isHovered
            ? `rgba(255, 255, 255, 0.8)`
            : `rgba(20, 20, 20, ${opacity})`;
        ctx.stroke();

        // Render Labels (always on for Product/Attribute, hover-dependent for Evidence)
        if (n.group !== "Evidence" || isHovered || isSelected || transform.k > 1.2) {
          ctx.fillStyle = `rgba(244, 244, 245, ${opacity})`; // Ivory
          ctx.font = `bold ${n.group === "Product" ? 11 : 9.5}px monospace`;
          ctx.textAlign = "center";
          ctx.fillText(n.label, n.x || 0, (n.y || 0) + size + 14);
        }
      });

      ctx.restore();

      animFrameId = requestAnimationFrame(tick);
    };

    animFrameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animFrameId);
    };
  }, [data, isPlaying, selectedNode]);

  // Canvas interaction mouse handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mX = e.clientX - rect.left;
    const mY = e.clientY - rect.top;

    // Convert screen mouse pos to simulation coords using current transform
    const t = transformRef.current;
    const simX = (mX - t.x) / t.k;
    const simY = (mY - t.y) / t.k;

    // Find clicked node
    const clickedNode = nodesRef.current.find((n) => {
      const dx = (n.x || 0) - simX;
      const dy = (n.y || 0) - simY;
      const size = n.group === "Product" ? 22 : 16;
      return dx * dx + dy * dy <= size * size;
    });

    if (clickedNode) {
      activeDragNodeRef.current = clickedNode;
      clickedNode.fx = clickedNode.x;
      clickedNode.fy = clickedNode.y;
      setSelectedNode(clickedNode);
    } else {
      dragStartRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mX = e.clientX - rect.left;
    const mY = e.clientY - rect.top;

    const t = transformRef.current;
    const simX = (mX - t.x) / t.k;
    const simY = (mY - t.y) / t.k;

    // Check hover
    const hitNode = nodesRef.current.find((n) => {
      const dx = (n.x || 0) - simX;
      const dy = (n.y || 0) - simY;
      const size = n.group === "Product" ? 22 : 16;
      return dx * dx + dy * dy <= size * size;
    }) || null;

    hoveredNodeRef.current = hitNode;

    // Handle Dragging Node
    if (activeDragNodeRef.current) {
      const node = activeDragNodeRef.current;
      node.fx = simX;
      node.fy = simY;
      node.x = simX;
      node.y = simY;
      return;
    }

    // Handle Panning Map
    if (dragStartRef.current) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      transformRef.current = {
        x: t.x + dx,
        y: t.y + dy,
        k: t.k,
      };
      dragStartRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseUp = () => {
    if (activeDragNodeRef.current) {
      activeDragNodeRef.current.fx = null;
      activeDragNodeRef.current.fy = null;
      activeDragNodeRef.current = null;
    }
    dragStartRef.current = null;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mX = e.clientX - rect.left;
    const mY = e.clientY - rect.top;

    const t = transformRef.current;
    const zoomFactor = 1.08;
    const nextK = e.deltaY < 0 ? t.k * zoomFactor : t.k / zoomFactor;

    // Cap Zoom boundaries
    const k = Math.min(Math.max(nextK, 0.35), 4.0);

    // Zoom centered on current mouse coordinates
    const nextX = mX - (mX - t.x) * (k / t.k);
    const nextY = mY - (mY - t.y) * (k / t.k);

    transformRef.current = { x: nextX, y: nextY, k };
  };

  const zoom = (factor: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const t = transformRef.current;
    const nextK = t.k * factor;
    const k = Math.min(Math.max(nextK, 0.35), 4.0);

    const mX = canvas.width / 2;
    const mY = canvas.height / 2;
    const nextX = mX - (mX - t.x) * (k / t.k);
    const nextY = mY - (mY - t.y) * (k / t.k);

    transformRef.current = { x: nextX, y: nextY, k };
  };

  const resetView = () => {
    transformRef.current = { x: 0, y: 0, k: 1 };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4 backdrop-blur-md">
      <div className="relative flex h-[90vh] w-[95vw] max-w-6xl flex-col border border-line bg-panel backdrop-blur-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-ivory">
              ProductTwin Relational Knowledge Graph
            </h2>
            <p className="font-mono text-[10px] tracking-wide text-mist uppercase mt-0.5">
              Live Interactive Visualization of Extracted Metadata Relationships
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md border border-line bg-panel-2 p-1.5 text-mist hover:border-teal hover:text-teal transition"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Content Body */}
        <div className="relative flex flex-1 overflow-hidden">
          {/* Main Visualizer Area */}
          <div className="relative flex-1 bg-ink/40">
            {loading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="h-8 w-8 animate-spin rounded-full border-2 border-teal border-t-transparent" />
                <span className="mt-4 font-mono text-[11px] tracking-widest text-mist uppercase">
                  Mapping database edges...
                </span>
              </div>
            ) : error ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                <span className="text-amber text-lg font-semibold">Graph Generation Offline</span>
                <p className="mt-2 text-sm text-mist max-w-md">{error}</p>
                <button
                  onClick={onClose}
                  className="mt-6 rounded-md border border-line bg-panel-2 px-4 py-2 font-mono text-xs text-ivory uppercase hover:border-teal"
                >
                  Close Viewer
                </button>
              </div>
            ) : (
              <>
                <canvas
                  ref={canvasRef}
                  width={800}
                  height={500}
                  className="h-full w-full cursor-grab active:cursor-grabbing"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onWheel={handleWheel}
                />

                {/* Visualizer HUD overlay controls */}
                <div className="absolute bottom-4 left-4 flex gap-2">
                  <button
                    onClick={() => zoom(1.2)}
                    className="flex h-8 w-8 items-center justify-center rounded border border-line bg-panel-2 text-ivory hover:border-teal"
                    title="Zoom In"
                  >
                    +
                  </button>
                  <button
                    onClick={() => zoom(1 / 1.2)}
                    className="flex h-8 w-8 items-center justify-center rounded border border-line bg-panel-2 text-ivory hover:border-teal"
                    title="Zoom Out"
                  >
                    -
                  </button>
                  <button
                    onClick={resetView}
                    className="flex px-2.5 h-8 items-center justify-center rounded border border-line bg-panel-2 font-mono text-[10px] text-ivory hover:border-teal"
                    title="Reset View"
                  >
                    RESET
                  </button>
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className={`flex px-2.5 h-8 items-center justify-center rounded border font-mono text-[10px] uppercase transition ${isPlaying
                      ? "border-teal/50 bg-teal/10 text-teal"
                      : "border-line bg-panel-2 text-ivory hover:border-teal"
                      }`}
                  >
                    {isPlaying ? "Simulate: Active" : "Simulate: Paused"}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Side Inspector Drawer */}
          <div className="w-80 border-l border-line bg-panel-2/90 flex flex-col">
            <div className="border-b border-line p-4 bg-panel-2">
              <span className="font-mono text-[10px] tracking-[0.2em] text-mist uppercase">
                Properties Panel
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {selectedNode ? (
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${selectedNode.group === "Product"
                        ? "bg-teal"
                        : selectedNode.group === "Source"
                          ? "bg-amber"
                          : selectedNode.group === "Attribute"
                            ? "bg-violet"
                            : "bg-blue"
                        }`}
                    />
                    <span className="font-mono text-[11px] font-semibold text-ivory uppercase tracking-wide">
                      {selectedNode.group} Node
                    </span>
                  </div>

                  <h3 className="mt-3 font-display text-lg font-bold text-ivory leading-tight">
                    {selectedNode.label}
                  </h3>

                  <div className="mt-5 border-t border-line pt-4 space-y-3 font-mono text-xs">
                    {selectedNode.group === "Product" && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-mist">Product ID:</span>
                          <span className="text-ivory font-bold">{selectedNode.id.split("_")[1]}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-mist">Category:</span>
                          <span className="text-teal">{selectedNode.category || "General"}</span>
                        </div>
                      </>
                    )}

                    {selectedNode.group === "Source" && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-mist">Source ID:</span>
                          <span className="text-ivory">{selectedNode.id.split("_")[1]}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-mist">Media Type:</span>
                          <span className="text-amber uppercase">{selectedNode.type}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-mist">Trust Score:</span>
                          <span className="text-ivory font-bold">{Math.round((selectedNode.trust_score || 0.9) * 100)}%</span>
                        </div>
                      </>
                    )}

                    {selectedNode.group === "Attribute" && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-mist">Value Unit:</span>
                          <span className="text-violet">{selectedNode.unit || "N/A"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-mist">Confidence:</span>
                          <span className="text-ivory font-bold">{selectedNode.confidence || "0.0"}%</span>
                        </div>
                      </>
                    )}

                    {selectedNode.group === "Evidence" && (
                      <div className="space-y-2">
                        <div className="text-mist">Excerpt Content:</div>
                        <div className="bg-ink/40 p-3 rounded border border-line font-sans text-xs text-ivory leading-relaxed max-h-48 overflow-y-auto">
                          "{selectedNode.content || "No excerpt text available."}"
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-4">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="h-10 w-10 text-mist/40"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                  <p className="mt-3 text-xs text-mist leading-relaxed">
                    Click on any node in the knowledge graph to view its attributes, sources, evidence excerpts, and details.
                  </p>
                </div>
              )}
            </div>

            {/* Legend footer */}
            <div className="border-t border-line p-4 space-y-2 font-mono text-[9px] uppercase tracking-wider text-mist">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-teal" /> Product Node (SKU)
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber" /> Ingested Source
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-violet" /> Extracted Attribute
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue" /> Source Evidence
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
