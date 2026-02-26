import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ─── Design tokens ───
const T = {
  bg: {
    app: "#0e0f11",
    panel: "#141518",
    surface: "#1a1b1f",
    elevated: "#1f2024",
    hover: "#25262b",
    active: "#2c2d33",
    overlay: "rgba(0,0,0,0.6)",
  },
  border: {
    subtle: "#1e1f25",
    default: "#2a2b32",
    strong: "#3a3b42",
  },
  text: {
    primary: "#e8e9ed",
    secondary: "#9a9ba3",
    tertiary: "#6b6c74",
    inverse: "#0e0f11",
  },
  accent: {
    teal: "#2dd4a8",
    tealMuted: "#1a8c6e",
    tealBg: "rgba(45,212,168,0.08)",
    tealBorder: "rgba(45,212,168,0.15)",
    amber: "#f0b429",
    amberBg: "rgba(240,180,41,0.08)",
    red: "#ef6b6b",
    redBg: "rgba(239,107,107,0.08)",
    blue: "#5b9cf5",
    blueBg: "rgba(91,156,245,0.08)",
    violet: "#a78bfa",
    violetBg: "rgba(167,139,250,0.08)",
  },
  feature: {
    promoter: "#2dd4a8",
    cds: "#5b9cf5",
    terminator: "#ef6b6b",
    ori: "#f0b429",
    resistance: "#a78bfa",
    tag: "#f472b6",
    rbs: "#67e8f9",
    misc: "#9a9ba3",
  },
  radius: { sm: "4px", md: "6px", lg: "8px", xl: "12px" },
  font: {
    sans: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', monospace",
    display: "'Instrument Sans', 'DM Sans', sans-serif",
  },
};

// ─── Plasmid data ───
const PLASMID = {
  name: "pET28a-GFP",
  length: 5861,
  topology: "circular",
  features: [
    { name: "T7 promoter", type: "promoter", start: 370, end: 389, color: T.feature.promoter, strand: 1 },
    { name: "lac operator", type: "misc", start: 390, end: 412, color: T.feature.misc, strand: 1 },
    { name: "RBS", type: "rbs", start: 413, end: 419, color: T.feature.rbs, strand: 1 },
    { name: "His6-tag", type: "tag", start: 420, end: 438, color: T.feature.tag, strand: 1 },
    { name: "eGFP", type: "cds", start: 470, end: 1189, color: T.feature.cds, strand: 1 },
    { name: "T7 terminator", type: "terminator", start: 1190, end: 1237, color: T.feature.terminator, strand: 1 },
    { name: "KanR", type: "resistance", start: 1620, end: 2432, color: T.feature.resistance, strand: -1 },
    { name: "pBR322 ori", type: "ori", start: 2850, end: 3464, color: T.feature.ori, strand: 1 },
    { name: "f1 ori", type: "ori", start: 4580, end: 5034, color: "#f0b429", strand: -1 },
    { name: "lacI", type: "cds", start: 5040, end: 5861, color: "#60a5fa", strand: -1 },
  ],
  enzymes: [
    { name: "NdeI", position: 439, overhang: "5'" },
    { name: "NcoI", position: 296, overhang: "5'" },
    { name: "BamHI", position: 1189, overhang: "5'" },
    { name: "XhoI", position: 1194, overhang: "5'" },
    { name: "EcoRI", position: 192, overhang: "5'" },
    { name: "HindIII", position: 173, overhang: "5'" },
  ],
};

const SEQUENCE_CHUNK = "ATGGTGAGCAAGGGCGAGGAGCTGTTCACCGGGGTGGTGCCCATCCTGGTCGAGCTGGACGGCGACGTAAACGGCCACAAGTTCAGCGTGTCCGGCGAGGGCGAGGGCGATGCCACCTACGGCAAGCTGACCCTGAAGTTCATCTGCACCACCGGCAAGCTGCCCGTGCCCTGGCCCACCCTCGTGACCACCCTGACCTACGGCGTGCAGTGCTTCAGCCGCTACCCCGACCACATGAAGCAGCACGACTTCTTCAAGTCCGCCATGCCCGAAGGCTACGTCCAGGAGCGCACCATCTTCTTCAAGGACGACGGCAACTACAAGACCCGCGCCGAGGTGAAGTTCGAGGGCGACACCCTGGTGAACCGCATCGAGCTGAAGGGCATCGACTTCAAGGAGGACGGCAACATCCTGGGGCACAAGCTGGAGTACAACTACAACAGCCACAACGTCTATATCATGGCCGACAAGCAGAAGAACGGCATCAAGGTGAACTTCAAGATCCGCCACAACATCGAGGACGGCAGCGTGCAGCTCGCCGACCACTACCAGCAGAAC";

// ─── Circular map drawing ───
function CircularMap({ width, height }) {
  const canvasRef = useRef(null);
  const [hovered, setHovered] = useState(null);
  const [selectedFeature, setSelectedFeature] = useState("eGFP");
  
  const cx = width / 2;
  const cy = height / 2;
  const outerR = Math.min(cx, cy) - 70;
  const trackWidth = 22;
  const innerR = outerR - trackWidth;

  const angleFor = useCallback((pos) => {
    return ((pos / PLASMID.length) * 2 * Math.PI) - Math.PI / 2;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // Background ring
    ctx.beginPath();
    ctx.arc(cx, cy, outerR - trackWidth / 2, 0, Math.PI * 2);
    ctx.strokeStyle = T.border.default;
    ctx.lineWidth = trackWidth;
    ctx.stroke();

    // Tick marks
    for (let i = 0; i < PLASMID.length; i += 500) {
      const a = angleFor(i);
      const r1 = outerR + 2;
      const r2 = outerR + 8;
      ctx.beginPath();
      ctx.moveTo(cx + r1 * Math.cos(a), cy + r1 * Math.sin(a));
      ctx.lineTo(cx + r2 * Math.cos(a), cy + r2 * Math.sin(a));
      ctx.strokeStyle = T.border.strong;
      ctx.lineWidth = 1;
      ctx.stroke();

      if (i % 1000 === 0) {
        const r3 = outerR + 20;
        ctx.font = `10px ${T.font.mono}`;
        ctx.fillStyle = T.text.tertiary;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${i === 0 ? PLASMID.length : i}`, cx + r3 * Math.cos(a), cy + r3 * Math.sin(a));
      }
    }

    // Features as arcs
    PLASMID.features.forEach((f) => {
      const startA = angleFor(f.start);
      const endA = angleFor(f.end);
      const isSelected = f.name === selectedFeature;
      const isHov = f.name === hovered;

      ctx.beginPath();
      ctx.arc(cx, cy, outerR - trackWidth / 2, startA, endA);
      ctx.strokeStyle = f.color;
      ctx.lineWidth = isSelected ? trackWidth + 4 : isHov ? trackWidth + 2 : trackWidth;
      ctx.lineCap = "butt";
      ctx.globalAlpha = isSelected ? 1 : isHov ? 0.9 : 0.75;
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Selection glow
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(cx, cy, outerR - trackWidth / 2, startA, endA);
        ctx.strokeStyle = f.color;
        ctx.lineWidth = trackWidth + 12;
        ctx.globalAlpha = 0.1;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Feature label
      const midA = (startA + endA) / 2;
      const labelR = innerR - 20;
      const lx = cx + labelR * Math.cos(midA);
      const ly = cy + labelR * Math.sin(midA);

      ctx.save();
      ctx.translate(lx, ly);
      let rot = midA + Math.PI / 2;
      if (rot > Math.PI / 2 && rot < (3 * Math.PI) / 2) rot += Math.PI;
      ctx.rotate(rot);
      ctx.font = `${isSelected ? "600" : "400"} 11px ${T.font.sans}`;
      ctx.fillStyle = isSelected ? f.color : T.text.secondary;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(f.name, 0, 0);
      ctx.restore();

      // Direction arrow
      if (f.strand !== 0) {
        const arrowA = f.strand === 1 ? endA - 0.02 : startA + 0.02;
        const ar = outerR - trackWidth / 2;
        const ax = cx + ar * Math.cos(arrowA);
        const ay = cy + ar * Math.sin(arrowA);
        ctx.beginPath();
        const arrowSize = 5;
        const da = f.strand === 1 ? 0.03 : -0.03;
        ctx.moveTo(ax, ay);
        ctx.lineTo(
          cx + (ar - arrowSize) * Math.cos(arrowA - da),
          cy + (ar - arrowSize) * Math.sin(arrowA - da)
        );
        ctx.lineTo(
          cx + (ar + arrowSize) * Math.cos(arrowA - da),
          cy + (ar + arrowSize) * Math.sin(arrowA - da)
        );
        ctx.closePath();
        ctx.fillStyle = f.color;
        ctx.globalAlpha = 0.9;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    });

    // Enzyme cut sites
    PLASMID.enzymes.forEach((e) => {
      const a = angleFor(e.position);
      const r1 = outerR + 2;
      const r2 = outerR + 14;
      ctx.beginPath();
      ctx.moveTo(cx + r1 * Math.cos(a), cy + r1 * Math.sin(a));
      ctx.lineTo(cx + r2 * Math.cos(a), cy + r2 * Math.sin(a));
      ctx.strokeStyle = T.accent.amber;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Enzyme label
      const r3 = outerR + 26;
      ctx.save();
      ctx.translate(cx + r3 * Math.cos(a), cy + r3 * Math.sin(a));
      let rot = a;
      if (a > Math.PI / 2 || a < -Math.PI / 2) rot += Math.PI;
      ctx.rotate(rot);
      ctx.font = `10px ${T.font.mono}`;
      ctx.fillStyle = T.accent.amber;
      ctx.globalAlpha = 0.7;
      ctx.textAlign = "center";
      ctx.fillText(e.name, 0, 0);
      ctx.globalAlpha = 1;
      ctx.restore();
    });

    // Center info
    ctx.font = `600 16px ${T.font.display}`;
    ctx.fillStyle = T.text.primary;
    ctx.textAlign = "center";
    ctx.fillText(PLASMID.name, cx, cy - 14);
    ctx.font = `12px ${T.font.mono}`;
    ctx.fillStyle = T.text.tertiary;
    ctx.fillText(`${PLASMID.length.toLocaleString()} bp`, cx, cy + 6);
    ctx.font = `10px ${T.font.sans}`;
    ctx.fillStyle = T.text.tertiary;
    ctx.fillText("circular", cx, cy + 22);

  }, [width, height, hovered, selectedFeature, cx, cy, outerR, innerR, trackWidth, angleFor]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height, cursor: "crosshair" }}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const mx = e.clientX - rect.left - cx;
        const my = e.clientY - rect.top - cy;
        const dist = Math.sqrt(mx * mx + my * my);
        if (dist > innerR - 5 && dist < outerR + 5) {
          let angle = Math.atan2(my, mx) + Math.PI / 2;
          if (angle < 0) angle += Math.PI * 2;
          const pos = (angle / (Math.PI * 2)) * PLASMID.length;
          const hit = PLASMID.features.find(
            (f) => pos >= f.start && pos <= f.end
          );
          setHovered(hit?.name || null);
        } else {
          setHovered(null);
        }
      }}
      onClick={() => { if (hovered) setSelectedFeature(hovered); }}
    />
  );
}

// ─── Feature type icon ───
function FeatureIcon({ type, color, size = 14 }) {
  const s = size;
  return (
    <svg width={s} height={s} viewBox="0 0 14 14" fill="none">
      {type === "promoter" && (
        <path d="M2 10V4l8 3-8 3z" fill={color} opacity="0.8" />
      )}
      {type === "terminator" && (
        <>
          <line x1="7" y1="3" x2="7" y2="11" stroke={color} strokeWidth="1.5" opacity="0.8" />
          <line x1="3" y1="3" x2="11" y2="3" stroke={color} strokeWidth="2" opacity="0.8" />
        </>
      )}
      {type === "cds" && (
        <rect x="1" y="3" width="12" height="8" rx="2" fill={color} opacity="0.6" />
      )}
      {type === "ori" && (
        <circle cx="7" cy="7" r="5" stroke={color} strokeWidth="1.5" fill="none" opacity="0.8" />
      )}
      {type === "resistance" && (
        <path d="M3 11L7 3l4 8H3z" fill={color} opacity="0.6" />
      )}
      {(type === "tag" || type === "rbs" || type === "misc") && (
        <rect x="2" y="4" width="10" height="6" rx="3" fill={color} opacity="0.5" />
      )}
    </svg>
  );
}

// ─── App ───
export default function HelixApp() {
  const [activeTab, setActiveTab] = useState("map");
  const [bottomTab, setBottomTab] = useState("enzymes");
  const [selectedFeature, setSelectedFeature] = useState(PLASMID.features[4]); // eGFP
  const [cmdOpen, setCmdOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const versions = [
    { id: 1, date: "Now", desc: "Unsaved changes", current: true },
    { id: 2, date: "Feb 24", time: "3:41 PM", desc: "Added NLS to N-terminus" },
    { id: 3, date: "Feb 22", time: "11:02 AM", desc: "Codon optimized eGFP for E. coli" },
    { id: 4, date: "Feb 20", time: "9:15 AM", desc: "Initial import from Addgene #69763" },
  ];

  const bases = SEQUENCE_CHUNK.split("");

  return (
    <div style={{
      width: "100%", height: "100vh", background: T.bg.app, color: T.text.primary,
      fontFamily: T.font.sans, fontSize: 13, display: "flex", flexDirection: "column",
      overflow: "hidden", userSelect: "none",
    }}>
      {/* Google Fonts */}
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@300;400;500&display=swap" rel="stylesheet" />

      {/* ─── Title Bar ─── */}
      <div style={{
        height: 44, display: "flex", alignItems: "center",
        borderBottom: `1px solid ${T.border.subtle}`,
        background: T.bg.panel, padding: "0 12px", gap: 8, flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: 12 }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 2C6 2 4 5 4 10s2 8 6 8 6-3 6-8-2-8-6-8z" stroke={T.accent.teal} strokeWidth="1.5" fill="none"/>
            <path d="M6.5 6.5Q10 9 13.5 6.5M6.5 10Q10 13 13.5 10M6.5 13.5Q10 16 13.5 13.5" stroke={T.accent.teal} strokeWidth="1" opacity="0.6"/>
          </svg>
          <span style={{ fontFamily: T.font.display, fontWeight: 600, fontSize: 14, letterSpacing: "-0.01em" }}>Helix</span>
        </div>

        {/* File tabs */}
        <div style={{ display: "flex", gap: 2, flex: 1 }}>
          {[
            { name: "pET28a-GFP", active: true },
            { name: "pUC19-mCherry", active: false },
          ].map((tab) => (
            <div key={tab.name} style={{
              padding: "5px 14px", borderRadius: T.radius.md, fontSize: 12, fontWeight: 500,
              background: tab.active ? T.bg.surface : "transparent",
              color: tab.active ? T.text.primary : T.text.tertiary,
              cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
              border: tab.active ? `1px solid ${T.border.default}` : "1px solid transparent",
              transition: "all 0.15s ease",
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: tab.active ? T.accent.teal : T.text.tertiary, opacity: 0.6 }} />
              {tab.name}
              {tab.active && <span style={{ fontSize: 10, color: T.text.tertiary, marginLeft: 4 }}>●</span>}
            </div>
          ))}
          <div style={{
            padding: "5px 10px", borderRadius: T.radius.md, color: T.text.tertiary,
            cursor: "pointer", fontSize: 14,
          }}>+</div>
        </div>

        {/* Command palette hint */}
        <div onClick={() => setCmdOpen(true)} style={{
          display: "flex", alignItems: "center", gap: 6, padding: "4px 10px",
          borderRadius: T.radius.md, border: `1px solid ${T.border.default}`,
          cursor: "pointer", color: T.text.tertiary, fontSize: 11,
          background: T.bg.surface,
        }}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" opacity="0.5">
            <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85zm-5.242.656a5 5 0 1 1 0-10 5 5 0 0 1 0 10z" />
          </svg>
          <span>Search or jump to...</span>
          <kbd style={{
            fontSize: 10, padding: "1px 5px", borderRadius: 3,
            background: T.bg.hover, color: T.text.tertiary, fontFamily: T.font.mono,
          }}>⌘K</kbd>
        </div>
      </div>

      {/* ─── Main Content ─── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* ─── Left Sidebar ─── */}
        {!sidebarCollapsed && (
          <div style={{
            width: 220, borderRight: `1px solid ${T.border.subtle}`,
            background: T.bg.panel, display: "flex", flexDirection: "column",
            flexShrink: 0,
          }}>
            {/* Sidebar search */}
            <div style={{ padding: "10px 10px 6px" }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 6, padding: "6px 8px",
                borderRadius: T.radius.md, background: T.bg.surface, border: `1px solid ${T.border.default}`,
              }}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill={T.text.tertiary}>
                  <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85zm-5.242.656a5 5 0 1 1 0-10 5 5 0 0 1 0 10z" />
                </svg>
                <span style={{ fontSize: 11, color: T.text.tertiary }}>Search components...</span>
              </div>
            </div>

            {/* Sidebar sections */}
            <div style={{ flex: 1, overflow: "auto", padding: "4px 0" }}>
              {/* Parts Library */}
              <div style={{ padding: "8px 10px 4px" }}>
                <div style={{
                  fontSize: 10, fontWeight: 600, textTransform: "uppercase",
                  letterSpacing: "0.06em", color: T.text.tertiary, marginBottom: 6,
                }}>Component Library</div>
                {[
                  { name: "Promoters", count: 47, color: T.feature.promoter },
                  { name: "Coding Sequences", count: 124, color: T.feature.cds },
                  { name: "Terminators", count: 31, color: T.feature.terminator },
                  { name: "Origins", count: 18, color: T.feature.ori },
                  { name: "Resistance", count: 23, color: T.feature.resistance },
                  { name: "Tags & Linkers", count: 56, color: T.feature.tag },
                ].map((cat) => (
                  <div key={cat.name} style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "5px 8px",
                    borderRadius: T.radius.sm, cursor: "pointer",
                    transition: "background 0.1s",
                  }}
                    onMouseEnter={(e) => e.currentTarget.style.background = T.bg.hover}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: cat.color, opacity: 0.7 }} />
                    <span style={{ fontSize: 12, color: T.text.secondary, flex: 1 }}>{cat.name}</span>
                    <span style={{ fontSize: 10, color: T.text.tertiary, fontFamily: T.font.mono }}>{cat.count}</span>
                  </div>
                ))}
              </div>

              <div style={{ height: 1, background: T.border.subtle, margin: "8px 10px" }} />

              {/* This plasmid's features */}
              <div style={{ padding: "4px 10px" }}>
                <div style={{
                  fontSize: 10, fontWeight: 600, textTransform: "uppercase",
                  letterSpacing: "0.06em", color: T.text.tertiary, marginBottom: 6,
                }}>Features</div>
                {PLASMID.features.map((f) => (
                  <div key={f.name} style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "5px 8px",
                    borderRadius: T.radius.sm, cursor: "pointer",
                    background: selectedFeature?.name === f.name ? T.accent.tealBg : "transparent",
                    border: selectedFeature?.name === f.name ? `1px solid ${T.accent.tealBorder}` : "1px solid transparent",
                    transition: "all 0.1s",
                  }}
                    onClick={() => setSelectedFeature(f)}
                    onMouseEnter={(e) => { if (selectedFeature?.name !== f.name) e.currentTarget.style.background = T.bg.hover; }}
                    onMouseLeave={(e) => { if (selectedFeature?.name !== f.name) e.currentTarget.style.background = "transparent"; }}
                  >
                    <FeatureIcon type={f.type} color={f.color} />
                    <span style={{
                      fontSize: 12, flex: 1,
                      color: selectedFeature?.name === f.name ? T.text.primary : T.text.secondary,
                      fontWeight: selectedFeature?.name === f.name ? 500 : 400,
                    }}>{f.name}</span>
                    <span style={{
                      fontSize: 9, color: T.text.tertiary, fontFamily: T.font.mono,
                    }}>{f.strand === -1 ? "◄" : "►"}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── Center: Editor ─── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* View tabs */}
          <div style={{
            display: "flex", alignItems: "center", gap: 2, padding: "6px 12px",
            borderBottom: `1px solid ${T.border.subtle}`, flexShrink: 0,
          }}>
            {[
              { id: "map", label: "Map", icon: "◎" },
              { id: "linear", label: "Linear", icon: "━" },
              { id: "sequence", label: "Sequence", icon: "Ξ" },
            ].map((t) => (
              <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
                padding: "4px 12px", borderRadius: T.radius.md, border: "none",
                background: activeTab === t.id ? T.bg.surface : "transparent",
                color: activeTab === t.id ? T.text.primary : T.text.tertiary,
                fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: T.font.sans,
                display: "flex", alignItems: "center", gap: 5,
                outline: activeTab === t.id ? `1px solid ${T.border.default}` : "none",
                transition: "all 0.15s",
              }}>
                <span style={{ fontSize: 11 }}>{t.icon}</span>
                {t.label}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 10, color: T.text.tertiary, fontFamily: T.font.mono }}>
                {PLASMID.length.toLocaleString()} bp
              </span>
              <span style={{ fontSize: 10, color: T.text.tertiary }}>•</span>
              <span style={{ fontSize: 10, color: T.text.tertiary }}>GC 51.2%</span>
              <span style={{ fontSize: 10, color: T.text.tertiary }}>•</span>
              <span style={{
                fontSize: 10, color: T.accent.teal, fontFamily: T.font.mono,
                padding: "1px 6px", borderRadius: T.radius.sm, background: T.accent.tealBg,
              }}>circular</span>
            </div>
          </div>

          {/* Editor area */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Map view */}
            <div style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
              position: "relative", minHeight: 0,
            }}>
              {activeTab === "map" && <CircularMap width={440} height={400} />}
              {activeTab === "sequence" && (
                <div style={{
                  width: "100%", height: "100%", overflow: "auto", padding: "16px 20px",
                  fontFamily: T.font.mono, fontSize: 13, lineHeight: 1.8,
                }}>
                  {/* Position ruler */}
                  <div style={{ color: T.text.tertiary, fontSize: 10, marginBottom: 4, letterSpacing: "0.5em" }}>
                    {"470       480       490       500       510       520"}
                  </div>
                  {/* Sequence with coloring */}
                  <div style={{ wordBreak: "break-all", letterSpacing: "0.08em" }}>
                    {bases.map((b, i) => {
                      const colors = { A: "#2dd4a8", T: "#ef6b6b", G: "#f0b429", C: "#5b9cf5" };
                      const inSelection = i >= 0 && i < 720;
                      return (
                        <span key={i} style={{
                          color: colors[b] || T.text.secondary,
                          opacity: inSelection ? 1 : 0.4,
                          fontWeight: 400,
                          background: (i >= 200 && i < 210) ? "rgba(45,212,168,0.15)" : "transparent",
                          cursor: "text",
                        }}>{b}</span>
                      );
                    })}
                  </div>
                  {/* Translation */}
                  <div style={{ marginTop: 8, fontSize: 11, color: T.text.tertiary, letterSpacing: "0.24em" }}>
                    {"M  V  S  K  G  E  E  L  F  T  G  V  V  P  I  L  V  E  L  D  G  D  V  N  G  H  K  F  S  V  S  G  E  G  E  G  D  A  T  Y"}
                  </div>
                </div>
              )}
              {activeTab === "linear" && (
                <div style={{ width: "100%", padding: "40px 30px", overflow: "auto" }}>
                  {/* Simplified linear view */}
                  <div style={{ position: "relative", height: 80 }}>
                    <div style={{
                      position: "absolute", top: 35, left: 0, right: 0, height: 4,
                      background: T.border.default, borderRadius: 2,
                    }} />
                    {PLASMID.features.map((f) => {
                      const left = `${(f.start / PLASMID.length) * 100}%`;
                      const width = `${((f.end - f.start) / PLASMID.length) * 100}%`;
                      return (
                        <div key={f.name} style={{
                          position: "absolute", top: 28, left, width, height: 18,
                          background: f.color, borderRadius: 3, opacity: 0.7,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          overflow: "hidden",
                        }}>
                          <span style={{
                            fontSize: 9, color: "#fff", fontWeight: 500,
                            textShadow: "0 1px 2px rgba(0,0,0,0.5)", whiteSpace: "nowrap",
                          }}>{f.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* ─── Bottom Panel ─── */}
            <div style={{
              height: 180, borderTop: `1px solid ${T.border.subtle}`,
              background: T.bg.panel, flexShrink: 0, display: "flex", flexDirection: "column",
            }}>
              <div style={{
                display: "flex", gap: 2, padding: "6px 12px 0",
                borderBottom: `1px solid ${T.border.subtle}`,
              }}>
                {["enzymes", "primers", "features", "history"].map((t) => (
                  <button key={t} onClick={() => setBottomTab(t)} style={{
                    padding: "4px 10px 6px", borderRadius: `${T.radius.sm} ${T.radius.sm} 0 0`, border: "none",
                    background: "transparent", fontFamily: T.font.sans,
                    color: bottomTab === t ? T.text.primary : T.text.tertiary,
                    fontSize: 11, fontWeight: bottomTab === t ? 500 : 400, cursor: "pointer",
                    borderBottom: bottomTab === t ? `2px solid ${T.accent.teal}` : "2px solid transparent",
                    textTransform: "capitalize", transition: "all 0.1s",
                  }}>{t}</button>
                ))}
              </div>

              <div style={{ flex: 1, overflow: "auto", padding: "8px 12px" }}>
                {bottomTab === "enzymes" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
                    {PLASMID.enzymes.map((e) => (
                      <div key={e.name} style={{
                        display: "flex", alignItems: "center", gap: 8, padding: "6px 10px",
                        borderRadius: T.radius.sm, background: T.bg.surface,
                        border: `1px solid ${T.border.subtle}`, cursor: "pointer",
                        transition: "border-color 0.1s",
                      }}
                        onMouseEnter={(ev) => ev.currentTarget.style.borderColor = T.accent.amber}
                        onMouseLeave={(ev) => ev.currentTarget.style.borderColor = T.border.subtle}
                      >
                        <span style={{ fontSize: 11, color: T.accent.amber, fontFamily: T.font.mono, fontWeight: 500, width: 50 }}>{e.name}</span>
                        <span style={{ fontSize: 10, color: T.text.tertiary, fontFamily: T.font.mono }}>{e.position}</span>
                        <span style={{
                          fontSize: 9, color: T.text.tertiary, padding: "1px 5px",
                          background: T.accent.amberBg, borderRadius: T.radius.sm, marginLeft: "auto",
                        }}>{e.overhang}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ─── Right Panel ─── */}
        <div style={{
          width: 240, borderLeft: `1px solid ${T.border.subtle}`,
          background: T.bg.panel, display: "flex", flexDirection: "column",
          flexShrink: 0, overflow: "auto",
        }}>
          {/* Properties */}
          <div style={{ padding: "12px 14px" }}>
            <div style={{
              fontSize: 10, fontWeight: 600, textTransform: "uppercase",
              letterSpacing: "0.06em", color: T.text.tertiary, marginBottom: 10,
            }}>Properties</div>
            
            {selectedFeature && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
                  borderRadius: T.radius.md, background: T.bg.surface,
                  border: `1px solid ${T.border.default}`,
                }}>
                  <FeatureIcon type={selectedFeature.type} color={selectedFeature.color} size={16} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.text.primary }}>{selectedFeature.name}</div>
                    <div style={{ fontSize: 10, color: T.text.tertiary, textTransform: "capitalize" }}>{selectedFeature.type}</div>
                  </div>
                </div>

                {[
                  { label: "Position", value: `${selectedFeature.start}..${selectedFeature.end}` },
                  { label: "Length", value: `${selectedFeature.end - selectedFeature.start} bp` },
                  { label: "Strand", value: selectedFeature.strand === 1 ? "Forward (+)" : "Reverse (−)" },
                  { label: "Frame", value: selectedFeature.type === "cds" ? "+1" : "—" },
                ].map((row) => (
                  <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "0 2px" }}>
                    <span style={{ fontSize: 11, color: T.text.tertiary }}>{row.label}</span>
                    <span style={{ fontSize: 11, color: T.text.primary, fontFamily: T.font.mono }}>{row.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ height: 1, background: T.border.subtle, margin: "0 14px" }} />

          {/* Computed */}
          <div style={{ padding: "12px 14px" }}>
            <div style={{
              fontSize: 10, fontWeight: 600, textTransform: "uppercase",
              letterSpacing: "0.06em", color: T.text.tertiary, marginBottom: 10,
            }}>Computed</div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { label: "GC Content", value: "54.2%", bar: 0.542, color: T.accent.teal },
                { label: "Tm (selection)", value: "72.3°C", bar: 0.72, color: T.accent.blue },
                { label: "Rare codons", value: "3 / 240", bar: 0.0125, color: T.accent.amber },
                { label: "CAI (E. coli)", value: "0.81", bar: 0.81, color: T.accent.violet },
              ].map((m) => (
                <div key={m.label} style={{ padding: "6px 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: T.text.secondary }}>{m.label}</span>
                    <span style={{ fontSize: 11, color: T.text.primary, fontFamily: T.font.mono, fontWeight: 500 }}>{m.value}</span>
                  </div>
                  <div style={{ height: 3, background: T.bg.hover, borderRadius: 2, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", width: `${m.bar * 100}%`,
                      background: m.color, borderRadius: 2, opacity: 0.6,
                      transition: "width 0.3s ease",
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ height: 1, background: T.border.subtle, margin: "0 14px" }} />

          {/* Version Timeline */}
          <div style={{ padding: "12px 14px", flex: 1 }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10,
            }}>
              <span style={{
                fontSize: 10, fontWeight: 600, textTransform: "uppercase",
                letterSpacing: "0.06em", color: T.text.tertiary,
              }}>Timeline</span>
              <span style={{
                fontSize: 9, padding: "2px 6px", borderRadius: T.radius.sm,
                background: T.accent.tealBg, color: T.accent.teal, fontWeight: 500,
              }}>4 versions</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column" }}>
              {versions.map((v, i) => (
                <div key={v.id} style={{ display: "flex", gap: 10, cursor: "pointer" }}>
                  {/* Timeline line + dot */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 16 }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                      background: v.current ? T.accent.teal : T.bg.hover,
                      border: `2px solid ${v.current ? T.accent.teal : T.border.strong}`,
                      boxShadow: v.current ? `0 0 8px ${T.accent.teal}40` : "none",
                    }} />
                    {i < versions.length - 1 && (
                      <div style={{
                        width: 1, flex: 1, minHeight: 24,
                        background: T.border.default,
                      }} />
                    )}
                  </div>
                  {/* Content */}
                  <div style={{ paddingBottom: 16, flex: 1 }}>
                    <div style={{
                      fontSize: 11, fontWeight: v.current ? 500 : 400,
                      color: v.current ? T.accent.teal : T.text.secondary,
                      lineHeight: 1,
                    }}>{v.desc}</div>
                    <div style={{ fontSize: 10, color: T.text.tertiary, marginTop: 3 }}>
                      {v.date}{v.time ? ` · ${v.time}` : ""}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Command Palette Overlay ─── */}
      {cmdOpen && (
        <div style={{
          position: "fixed", inset: 0, background: T.bg.overlay,
          display: "flex", alignItems: "flex-start", justifyContent: "center",
          paddingTop: 120, zIndex: 100,
        }} onClick={() => setCmdOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{
            width: 520, background: T.bg.elevated, borderRadius: T.radius.xl,
            border: `1px solid ${T.border.strong}`,
            boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 4px 16px rgba(0,0,0,0.3)",
            overflow: "hidden",
          }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 10, padding: "14px 16px",
              borderBottom: `1px solid ${T.border.default}`,
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill={T.text.tertiary}>
                <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85zm-5.242.656a5 5 0 1 1 0-10 5 5 0 0 1 0 10z" />
              </svg>
              <span style={{ fontSize: 14, color: T.text.tertiary }}>Type a command or search...</span>
            </div>
            <div style={{ padding: "6px" }}>
              {[
                { label: "Gibson Assembly...", hint: "Cloning", kbd: "⌘G" },
                { label: "Find enzyme that cuts once", hint: "Analysis", kbd: null },
                { label: "Export as SVG", hint: "Export", kbd: "⌘⇧E" },
                { label: "Optimize codons for E. coli", hint: "Plugin", kbd: null },
                { label: "Toggle dark/light theme", hint: "Settings", kbd: null },
              ].map((item, i) => (
                <div key={item.label} style={{
                  display: "flex", alignItems: "center", padding: "8px 12px",
                  borderRadius: T.radius.md, cursor: "pointer",
                  background: i === 0 ? T.bg.hover : "transparent",
                  transition: "background 0.1s",
                }}
                  onMouseEnter={(e) => e.currentTarget.style.background = T.bg.hover}
                  onMouseLeave={(e) => { if (i !== 0) e.currentTarget.style.background = "transparent"; }}
                >
                  <span style={{ fontSize: 13, color: T.text.primary, flex: 1 }}>{item.label}</span>
                  <span style={{ fontSize: 11, color: T.text.tertiary, marginRight: item.kbd ? 10 : 0 }}>{item.hint}</span>
                  {item.kbd && (
                    <kbd style={{
                      fontSize: 10, padding: "1px 6px", borderRadius: 3,
                      background: T.bg.surface, color: T.text.tertiary, fontFamily: T.font.mono,
                      border: `1px solid ${T.border.default}`,
                    }}>{item.kbd}</kbd>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
