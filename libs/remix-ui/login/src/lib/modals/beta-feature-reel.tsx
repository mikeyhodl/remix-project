import React, { useState, useEffect, useCallback, useRef } from "react";

// ─── Types ───────────────────────────────────────────────────────

type FeatureKey = "models" | "mcp" | "cloud" | "quickdapp";

interface Feature {
  tag: string;
  tagColor: string;
  vizBg: string;
  headline: string;
  desc: string;
  btn: string;
  visual: FeatureKey;
}

interface BetaFeatureReelProps {
  /** Callback when a CTA button is clicked. Receives the feature key. */
  onAction?: (feature: FeatureKey) => void;
  /** Whether the reel can be dismissed via the × button. Defaults to true. */
  dismissible?: boolean;
  /** Auto-advance interval in ms. Set to 0 to disable. Defaults to 5000. */
  autoAdvanceMs?: number;
  /** Called when the user dismisses the reel. */
  onDismiss?: () => void;
}

interface NavArrowProps {
  direction: "left" | "right";
  onClick: () => void;
}

interface ModelChip {
  label: string;
  color: string;
  bg: string;
}

interface McpNode {
  label: string;
  color: string;
}

interface CloudFile {
  ext: string;
  color: string;
  colorDim: string;
  textColor: string;
}

// ─── Feature data ────────────────────────────────────────────────

const FEATURES: Feature[] = [
  {
    tag: "AI models",
    tagColor: "#9b7dff",
    vizBg: "linear-gradient(135deg, #2a1a40, #1a1a3a)",
    headline: "Advanced AI models",
    desc: "Claude Opus 4.6, Sonnet 4.6, and Codestral — pick the right model for the job. Audit contracts, generate code, or explain Solidity patterns.",
    btn: "Open AI assistant",
    visual: "models",
  },
  {
    tag: "MCP Integrations",
    tagColor: "#5b9cf5",
    vizBg: "linear-gradient(135deg, #1a2640, #1a1a30)",
    headline: "Alchemy, Etherscan, The Graph, ethSkills",
    desc: "MCP-connected tools bring on-chain data, verification, subgraph queries, and interactive Solidity lessons directly into your workflow.",
    btn: "Explore plugins",
    visual: "mcp",
  },
  {
    tag: "Cloud storage",
    tagColor: "#5b9cf5",
    vizBg: "linear-gradient(135deg, #1a2a3a, #1a2040)",
    headline: "Your workspaces, always available",
    desc: "Projects sync to the cloud automatically. Open any workspace from any device — your contracts, tests, and scripts are always there.",
    btn: "Enable cloud sync",
    visual: "cloud",
  },
  {
    tag: "QuickDApp",
    tagColor: "#6bdb8a",
    vizBg: "linear-gradient(135deg, #1a3020, #1a2a2a)",
    headline: "Generate a DApp from a prompt",
    desc: "Describe what you want, and QuickDApp scaffolds a full frontend connected to your contract. Deploy and share in minutes.",
    btn: "Create a DApp",
    visual: "quickdapp",
  },
];

// ─── Keyframe styles (injected once) ─────────────────────────────

const KEYFRAMES = `
  @keyframes betaReelFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
  @keyframes betaReelHubPulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(47,191,177,0.4); } 50% { box-shadow: 0 0 0 8px rgba(47,191,177,0); } }
  @keyframes betaReelMcpPop { 0% { opacity: 0; transform: scale(0.8) translateY(8px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
  @keyframes betaReelCloudBreathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
  @keyframes betaReelFileRise { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
  @keyframes betaReelArrowSlide { 0%, 100% { transform: translateX(0); opacity: 0.5; } 50% { transform: translateX(4px); opacity: 1; } }
`;

// ─── Visual sub-components ───────────────────────────────────────

const MODEL_CHIPS: ModelChip[] = [
  { label: "Claude Opus 4.6", color: "#9b7dff", bg: "rgba(155,125,255,0.15)" },
  { label: "Claude Sonnet 4.6", color: "#2fbfb1", bg: "rgba(47,191,177,0.15)" },
  { label: "Codestral", color: "#f0a030", bg: "rgba(240,160,48,0.15)" },
  { label: "Mistral", color: "#5b9cf5", bg: "rgba(91,156,245,0.15)" },
];

const MCP_NODES: McpNode[] = [
  { label: "Alchemy", color: "#5b9cf5" },
  { label: "Etherscan", color: "#f0a030" },
  { label: "The Graph", color: "#9b7dff" },
  { label: "ethSkills", color: "#6bdb8a" },
];

const CLOUD_FILES: CloudFile[] = [
  { ext: ".sol", color: "rgba(47,191,177,0.4)", colorDim: "rgba(47,191,177,0.2)", textColor: "#2fbfb1" },
  { ext: ".js", color: "rgba(155,125,255,0.4)", colorDim: "rgba(155,125,255,0.2)", textColor: "#9b7dff" },
  { ext: ".json", color: "rgba(240,160,48,0.4)", colorDim: "rgba(240,160,48,0.2)", textColor: "#f0a030" },
];

const ModelsVisual: React.FC = () => (
  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "center", padding: "0 12px" }}>
    {MODEL_CHIPS.map((chip, i) => (
      <span
        key={chip.label}
        style={{
          padding: "5px 12px",
          borderRadius: 7,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          fontWeight: 500,
          background: chip.bg,
          color: chip.color,
          animation: "betaReelFloat 3s ease-in-out infinite",
          animationDelay: `${i * 0.2}s`,
          whiteSpace: "nowrap",
        }}
      >
        {chip.label}
      </span>
    ))}
  </div>
);

const McpVisual: React.FC = () => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
    <div
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10,
        color: "#2fbfb1",
        letterSpacing: 1,
        textTransform: "uppercase",
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: "#2fbfb1",
          animation: "betaReelHubPulse 2s ease-in-out infinite",
          display: "inline-block",
        }}
      />
      MCP
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, width: 260 }}>
      {MCP_NODES.map((node, i) => (
        <div
          key={node.label}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 10px",
            borderRadius: 8,
            background: "rgba(255,255,255,0.04)",
            border: "0.5px solid rgba(255,255,255,0.06)",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            fontWeight: 500,
            color: "#e0e0ec",
            animation: "betaReelMcpPop 0.5s cubic-bezier(0.34,1.56,0.64,1) both",
            animationDelay: `${0.1 + i * 0.1}s`,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: node.color,
              boxShadow: `0 0 6px ${node.color}80`,
              flexShrink: 0,
            }}
          />
          {node.label}
        </div>
      ))}
    </div>
  </div>
);

const CloudVisual: React.FC = () => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
    <svg width="64" height="44" viewBox="0 0 64 44">
      <path
        d="M16 38c-6 0-11-4-11-10 0-5 3.5-9 8.5-10C15 12 20.5 6 28 6c9 0 16 6 17 14h1c5.5 0 10 4 10 9s-4.5 9-10 9H16z"
        fill="rgba(91,156,245,0.15)"
        stroke="rgba(91,156,245,0.4)"
        strokeWidth="1"
        style={{ animation: "betaReelCloudBreathe 3s ease-in-out infinite" }}
      />
    </svg>
    <div style={{ display: "flex", gap: 6 }}>
      {CLOUD_FILES.map((f, i) => (
        <div
          key={f.ext}
          style={{
            width: 28,
            height: 34,
            borderRadius: 4,
            background: "rgba(255,255,255,0.06)",
            border: "0.5px solid rgba(255,255,255,0.1)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
            animation: "betaReelFileRise 2s ease-in-out infinite",
            animationDelay: `${i * 0.3}s`,
          }}
        >
          <div style={{ width: 14, height: 2, borderRadius: 1, background: f.color }} />
          <div style={{ width: 10, height: 2, borderRadius: 1, background: f.colorDim }} />
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 7,
              fontWeight: 500,
              color: f.textColor,
            }}
          >
            {f.ext}
          </span>
        </div>
      ))}
    </div>
  </div>
);

const QuickDAppVisual: React.FC = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
    <div
      style={{
        padding: "8px 12px",
        borderRadius: 8,
        background: "rgba(255,255,255,0.04)",
        border: "0.5px solid rgba(255,255,255,0.1)",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10,
        color: "#8888aa",
        maxWidth: 110,
        lineHeight: 1.5,
      }}
    >
      <span style={{ color: "#6bdb8a" }}>&quot;</span>
      Build a token swap UI for my ERC-20
      <span style={{ color: "#6bdb8a" }}>&quot;</span>
    </div>
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        color: "#2fbfb1",
        animation: "betaReelArrowSlide 1.5s ease-in-out infinite",
      }}
    >
      <svg width="20" height="12" viewBox="0 0 20 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M1 6h16M14 2l4 4-4 4" />
      </svg>
    </div>
    <div
      style={{
        width: 100,
        height: 70,
        borderRadius: 8,
        background: "rgba(107,219,138,0.08)",
        border: "0.5px solid rgba(107,219,138,0.25)",
        display: "flex",
        flexDirection: "column",
        padding: 8,
        gap: 4,
      }}
    >
      {[70, 90, 50].map((w, i) => (
        <div key={i} style={{ height: 3, borderRadius: 2, background: "rgba(107,219,138,0.3)", width: `${w}%` }} />
      ))}
      <div
        style={{
          marginTop: "auto",
          height: 12,
          borderRadius: 3,
          background: "rgba(107,219,138,0.2)",
          border: "0.5px solid rgba(107,219,138,0.3)",
        }}
      />
    </div>
  </div>
);

const VISUALS: Record<FeatureKey, React.FC> = {
  models: ModelsVisual,
  mcp: McpVisual,
  cloud: CloudVisual,
  quickdapp: QuickDAppVisual,
};

// ─── NavArrow ────────────────────────────────────────────────────

const NavArrow: React.FC<NavArrowProps> = ({ direction, onClick }) => {
  const [hovered, setHovered] = useState(false);
  const d = direction === "left" ? "M9 3L5 7l4 4" : "M5 3l4 4-4 4";

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        background: hovered ? "#2a2a4a" : "#222240",
        border: "0.5px solid rgba(255,255,255,0.08)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        transition: "all 0.2s",
        color: hovered ? "#e0e0ec" : "#8888aa",
      }}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d={d} />
      </svg>
    </div>
  );
};

// ─── Main component ──────────────────────────────────────────────

const BetaFeatureReel: React.FC<BetaFeatureReelProps> = ({
  onAction,
  dismissible = true,
  autoAdvanceMs = 5000,
  onDismiss,
}) => {
  const [current, setCurrent] = useState<number>(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [animating, setAnimating] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const autoRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const count = FEATURES.length;

  const goTo = useCallback(
    (idx: number, dir?: 1 | -1) => {
      if (animating || idx === current) return;
      setDirection(dir ?? (idx > current ? 1 : -1));
      setAnimating(true);
      setTimeout(() => {
        setCurrent(idx);
        setAnimating(false);
      }, 400);
    },
    [animating, current]
  );

  const next = useCallback(() => goTo((current + 1) % count, 1), [current, count, goTo]);
  const prev = useCallback(() => goTo((current - 1 + count) % count, -1), [current, count, goTo]);

  // Auto-advance
  useEffect(() => {
    if (autoAdvanceMs <= 0) return;
    autoRef.current = setInterval(next, autoAdvanceMs);
    return () => {
      if (autoRef.current) clearInterval(autoRef.current);
    };
  }, [next, autoAdvanceMs]);

  const pauseAuto = useCallback(() => {
    if (autoRef.current) clearInterval(autoRef.current);
  }, []);

  const resumeAuto = useCallback(() => {
    if (autoAdvanceMs <= 0) return;
    if (autoRef.current) clearInterval(autoRef.current);
    autoRef.current = setInterval(next, autoAdvanceMs);
  }, [next, autoAdvanceMs]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        pauseAuto();
        next();
      }
      if (e.key === "ArrowLeft") {
        pauseAuto();
        prev();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [next, prev, pauseAuto]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    onDismiss?.();
  }, [onDismiss]);

  if (dismissed) return null;

  const feat = FEATURES[current];
  const VisualComp = VISUALS[feat.visual];
  const enterTransform = direction > 0 ? "translateX(40px)" : "translateX(-40px)";

  return (
    <>
      <style>{KEYFRAMES}</style>
      <style>{`
        @keyframes betaReelSlideIn {
          from { opacity: 0; transform: ${enterTransform}; }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      <div
        onMouseEnter={pauseAuto}
        onMouseLeave={resumeAuto}
        style={{
          fontFamily: "'DM Sans', sans-serif",
          color: "#e0e0ec",
          background: "#1a1a2e",
          borderRadius: 16,
          border: "0.5px solid rgba(47,191,177,0.2)",
          padding: 20,
          position: "relative",
          overflow: "hidden",
          width: 800,
          maxWidth: "100%",
          boxSizing: "border-box" as const,
        }}
      >
        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 500 }}>
            <span
              style={{
                width: 18,
                height: 18,
                background: "#2fbfb1",
                borderRadius: 4,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="2">
                <path d="M8 2v12M2 8h12" />
              </svg>
            </span>
            <span>Unlocked for you</span>
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 9,
                textTransform: "uppercase",
                letterSpacing: 1.5,
                color: "#2fbfb1",
                background: "rgba(47,191,177,0.12)",
                padding: "2px 8px",
                borderRadius: 4,
                border: "0.5px solid rgba(47,191,177,0.25)",
              }}
            >
              Beta perk
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Progress dots */}
            <div style={{ display: "flex", gap: 4 }}>
              {FEATURES.map((_, i) => (
                <div
                  key={i}
                  onClick={() => goTo(i)}
                  style={{
                    width: i === current ? 28 : 20,
                    height: 3,
                    borderRadius: 2,
                    background: i === current ? "#2fbfb1" : "rgba(255,255,255,0.1)",
                    cursor: "pointer",
                    transition: "all 0.3s",
                  }}
                />
              ))}
            </div>
            {/* Dismiss */}
            {dismissible && (
              <div
                onClick={handleDismiss}
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "#8888aa",
                  fontSize: 14,
                  transition: "color 0.2s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.color = "#e0e0ec";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.color = "#8888aa";
                }}
              >
                &times;
              </div>
            )}
          </div>
        </div>

        {/* ── Card area ── */}
        <div style={{ position: "relative", height: 340, overflow: "hidden" }}>
          <div
            key={current}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: "100%",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              animation: "betaReelSlideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards",
            }}
          >
            {/* Visual */}
            <div
              style={{
                flex: 1,
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
                background: feat.vizBg,
                overflow: "hidden",
                minHeight: 160,
              }}
            >
              <VisualComp />
            </div>

            {/* Text */}
            <div style={{ display: "block", width: "100%" }}>
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: 1.5,
                  color: feat.tagColor,
                  marginBottom: 4,
                }}
              >
                {feat.tag}
              </div>
              <div style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.3, marginBottom: 4, whiteSpace: "normal", wordWrap: "break-word", overflowWrap: "break-word" }}>{feat.headline}</div>
              <div style={{ fontSize: 13, color: "#8888aa", lineHeight: 1.5, whiteSpace: "normal", wordWrap: "break-word", overflowWrap: "break-word" }}>{feat.desc}</div>
              <div style={{ marginTop: 8 }}>
                <button
                  onClick={() => onAction?.(feat.visual)}
                  style={{
                    background: "rgba(47,191,177,0.12)",
                    color: "#2fbfb1",
                    border: "0.5px solid rgba(47,191,177,0.3)",
                    padding: "6px 16px",
                    borderRadius: 6,
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    const btn = e.currentTarget as HTMLButtonElement;
                    btn.style.background = "rgba(47,191,177,0.25)";
                    btn.style.borderColor = "#2fbfb1";
                  }}
                  onMouseLeave={(e) => {
                    const btn = e.currentTarget as HTMLButtonElement;
                    btn.style.background = "rgba(47,191,177,0.12)";
                    btn.style.borderColor = "rgba(47,191,177,0.3)";
                  }}
                >
                  {feat.btn}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Navigation ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
          <NavArrow direction="left" onClick={prev} />
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              color: "#8888aa",
            }}
          >
            {current + 1} / {count}
          </span>
          <NavArrow direction="right" onClick={next} />
        </div>
      </div>
    </>
  );
};

export default BetaFeatureReel;

// ─── Usage example ───────────────────────────────────────────────
//
//  import BetaFeatureReel from './BetaFeatureReel'
//  import type { FeatureKey } from './BetaFeatureReel' // if you export the type
//
//  const HomePage: React.FC<{ isBetaUser: boolean }> = ({ isBetaUser }) => {
//    if (!isBetaUser) return <DefaultHome />
//
//    const handleAction = (feature: FeatureKey) => {
//      switch (feature) {
//        case 'models':    activatePanel('ai-assistant'); break
//        case 'mcp':       activatePanel('plugin-manager'); break
//        case 'cloud':     activatePanel('cloud-settings'); break
//        case 'quickdapp': activatePanel('quickdapp'); break
//      }
//    }
//
//    return (
//      <BetaFeatureReel
//        dismissible
//        autoAdvanceMs={5000}
//        onAction={handleAction}
//        onDismiss={() => localStorage.setItem('beta-reel-dismissed', 'true')}
//      />
//    )
//  }
