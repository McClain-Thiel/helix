import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  tokens,
  useEditorStore,
  useActiveSequence,
  useSelectionStore,
  useViewStore,
  SequenceView,
  CircularMap,
  LinearMap,
  FeatureIcon,
  getFeatureColor,
} from '@helix/ui';
import type { SequenceDto, FeatureDto, EnzymeDto } from '@helix/ui';
import { useTauriCommand } from './hooks/useTauriCommand';

// Demo data matching the mockup - used when no file is loaded
const DEMO_SEQUENCE: SequenceDto = {
  id: 'demo-pET28a-GFP',
  name: 'pET28a-GFP',
  description: 'Expression vector with eGFP insert',
  topology: 'circular',
  sequence: generateDemoSequence(5861),
  length: 5861,
  features: [
    { id: 'f1', name: 'T7 promoter', featureType: 'promoter', start: 370, end: 389, strand: 1, color: '#2dd4a8', qualifiers: [] },
    { id: 'f2', name: 'lac operator', featureType: 'misc', start: 390, end: 412, strand: 1, color: '#9a9ba3', qualifiers: [] },
    { id: 'f3', name: 'RBS', featureType: 'rbs', start: 413, end: 419, strand: 1, color: '#67e8f9', qualifiers: [] },
    { id: 'f4', name: 'His6-tag', featureType: 'tag', start: 420, end: 438, strand: 1, color: '#f472b6', qualifiers: [] },
    { id: 'f5', name: 'eGFP', featureType: 'cds', start: 470, end: 1189, strand: 1, color: '#5b9cf5', qualifiers: [] },
    { id: 'f6', name: 'T7 terminator', featureType: 'terminator', start: 1190, end: 1237, strand: 1, color: '#ef6b6b', qualifiers: [] },
    { id: 'f7', name: 'KanR', featureType: 'resistance', start: 1620, end: 2432, strand: -1, color: '#a78bfa', qualifiers: [] },
    { id: 'f8', name: 'pBR322 ori', featureType: 'ori', start: 2850, end: 3464, strand: 1, color: '#f0b429', qualifiers: [] },
    { id: 'f9', name: 'f1 ori', featureType: 'ori', start: 4580, end: 5034, strand: -1, color: '#f0b429', qualifiers: [] },
    { id: 'f10', name: 'lacI', featureType: 'cds', start: 5040, end: 5861, strand: -1, color: '#60a5fa', qualifiers: [] },
  ],
};

const DEMO_ENZYMES: EnzymeDto[] = [
  { name: 'NdeI', position: 439, overhang: "5'" },
  { name: 'NcoI', position: 296, overhang: "5'" },
  { name: 'BamHI', position: 1189, overhang: "5'" },
  { name: 'XhoI', position: 1194, overhang: "5'" },
  { name: 'EcoRI', position: 192, overhang: "5'" },
  { name: 'HindIII', position: 173, overhang: "5'" },
];

function generateDemoSequence(length: number): string {
  const bases = 'ATCG';
  let seq = '';
  // Use a seeded-style approach for deterministic demo data
  for (let i = 0; i < length; i++) {
    seq += bases[(i * 7 + 3) % 4];
  }
  return seq;
}

export default function App() {
  const openSequence = useEditorStore((s) => s.openSequence);
  const activeSeq = useActiveSequence();
  const viewStore = useViewStore();
  const selectionStore = useSelectionStore();
  const { selectedFeatureId, selectFeature } = selectionStore;

  const [activeView, setActiveView] = useState<'map' | 'linear' | 'sequence'>('map');
  const [bottomTab, setBottomTab] = useState('enzymes');
  const editorAreaRef = useRef<HTMLDivElement>(null);
  const [editorSize, setEditorSize] = useState({ width: 600, height: 400 });

  // Load demo sequence on mount
  useEffect(() => {
    openSequence(DEMO_SEQUENCE);
  }, [openSequence]);

  // Measure editor area size
  useEffect(() => {
    const el = editorAreaRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setEditorSize({ width: Math.floor(width), height: Math.floor(height) });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Space key to toggle between circular and linear map
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setActiveView((v) => v === 'map' ? 'linear' : v === 'linear' ? 'map' : v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const sequence = activeSeq ?? DEMO_SEQUENCE;
  const selectedFeature = sequence.features.find((f) => f.id === selectedFeatureId);

  // Open file via Tauri
  const handleOpenFile = useCallback(async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const path = await open({
        filters: [
          { name: 'Sequence Files', extensions: ['gb', 'gbk', 'fasta', 'fa'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });
      if (path && typeof path === 'string') {
        const { invoke } = await import('@tauri-apps/api/core');
        const dto = await invoke<SequenceDto>('open_sequence_file', { path });
        openSequence(dto);
      }
    } catch (e) {
      console.warn('File open not available (running in browser?):', e);
    }
  }, [openSequence]);

  return (
    <div
      style={{
        width: '100%',
        height: '100vh',
        background: tokens.bg.app,
        color: tokens.text.primary,
        fontFamily: tokens.font.sans,
        fontSize: 13,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* Title Bar */}
      <div
        style={{
          height: 44,
          display: 'flex',
          alignItems: 'center',
          borderBottom: `1px solid ${tokens.border.subtle}`,
          background: tokens.bg.panel,
          padding: '0 12px',
          gap: 8,
          flexShrink: 0,
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 12 }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 2C6 2 4 5 4 10s2 8 6 8 6-3 6-8-2-8-6-8z" stroke={tokens.accent.teal} strokeWidth="1.5" fill="none" />
            <path d="M6.5 6.5Q10 9 13.5 6.5M6.5 10Q10 13 13.5 10M6.5 13.5Q10 16 13.5 13.5" stroke={tokens.accent.teal} strokeWidth="1" opacity="0.6" />
          </svg>
          <span style={{ fontFamily: tokens.font.display, fontWeight: 600, fontSize: 14, letterSpacing: '-0.01em' }}>
            Helix
          </span>
        </div>

        {/* File tabs */}
        <div style={{ display: 'flex', gap: 2, flex: 1 }}>
          <div
            style={{
              padding: '5px 14px',
              borderRadius: tokens.radius.md,
              fontSize: 12,
              fontWeight: 500,
              background: tokens.bg.surface,
              color: tokens.text.primary,
              border: `1px solid ${tokens.border.default}`,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: tokens.accent.teal, opacity: 0.6 }} />
            {sequence.name}
          </div>
          <div
            onClick={handleOpenFile}
            style={{
              padding: '5px 10px',
              borderRadius: tokens.radius.md,
              color: tokens.text.tertiary,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            +
          </div>
        </div>

        {/* Status bar info */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: tokens.text.tertiary, fontFamily: tokens.font.mono }}>
            {sequence.length.toLocaleString()} bp
          </span>
          <span style={{ fontSize: 10, color: tokens.text.tertiary }}>|</span>
          <span
            style={{
              fontSize: 10,
              color: tokens.accent.teal,
              fontFamily: tokens.font.mono,
              padding: '1px 6px',
              borderRadius: tokens.radius.sm,
              background: tokens.accent.tealBg,
            }}
          >
            {sequence.topology}
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Sidebar */}
        <div
          style={{
            width: 220,
            borderRight: `1px solid ${tokens.border.subtle}`,
            background: tokens.bg.panel,
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
            overflow: 'auto',
          }}
        >
          <div style={{ padding: '8px 10px 4px' }}>
            <div style={sectionHeader}>Features</div>
            {sequence.features.map((f) => (
              <div
                key={f.id}
                onClick={() => selectFeature(f.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '5px 8px',
                  borderRadius: tokens.radius.sm,
                  cursor: 'pointer',
                  background: selectedFeatureId === f.id ? tokens.accent.tealBg : 'transparent',
                  border: selectedFeatureId === f.id ? `1px solid ${tokens.accent.tealBorder}` : '1px solid transparent',
                }}
              >
                <FeatureIcon type={f.featureType} color={f.color} />
                <span
                  style={{
                    fontSize: 12,
                    flex: 1,
                    color: selectedFeatureId === f.id ? tokens.text.primary : tokens.text.secondary,
                    fontWeight: selectedFeatureId === f.id ? 500 : 400,
                  }}
                >
                  {f.name}
                </span>
                <span style={{ fontSize: 9, color: tokens.text.tertiary, fontFamily: tokens.font.mono }}>
                  {f.strand === -1 ? '\u25C4' : '\u25BA'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Center: Editor */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* View tabs */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              padding: '6px 12px',
              borderBottom: `1px solid ${tokens.border.subtle}`,
              flexShrink: 0,
            }}
          >
            {([
              { id: 'map' as const, label: 'Map', icon: '\u25CE' },
              { id: 'linear' as const, label: 'Linear', icon: '\u2501' },
              { id: 'sequence' as const, label: 'Sequence', icon: '\u039E' },
            ]).map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveView(t.id)}
                style={{
                  padding: '4px 12px',
                  borderRadius: tokens.radius.md,
                  border: 'none',
                  background: activeView === t.id ? tokens.bg.surface : 'transparent',
                  color: activeView === t.id ? tokens.text.primary : tokens.text.tertiary,
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: tokens.font.sans,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  outline: activeView === t.id ? `1px solid ${tokens.border.default}` : 'none',
                }}
              >
                <span style={{ fontSize: 11 }}>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>

          {/* Editor area */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div
              ref={editorAreaRef}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                minHeight: 0,
                overflow: 'hidden',
              }}
            >
              {activeView === 'map' && editorSize.width > 0 && (
                <CircularMap
                  sequence={sequence}
                  width={editorSize.width}
                  height={editorSize.height}
                />
              )}
              {activeView === 'sequence' && (
                <SequenceView sequence={sequence} />
              )}
              {activeView === 'linear' && editorSize.width > 0 && (
                <LinearMap
                  sequence={sequence}
                  width={editorSize.width}
                  height={editorSize.height}
                />
              )}
            </div>

            {/* Bottom Panel */}
            <div
              style={{
                height: 180,
                borderTop: `1px solid ${tokens.border.subtle}`,
                background: tokens.bg.panel,
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  gap: 2,
                  padding: '6px 12px 0',
                  borderBottom: `1px solid ${tokens.border.subtle}`,
                }}
              >
                {['enzymes', 'primers', 'features', 'history'].map((t) => (
                  <button
                    key={t}
                    onClick={() => setBottomTab(t)}
                    style={{
                      padding: '4px 10px 6px',
                      borderRadius: `${tokens.radius.sm} ${tokens.radius.sm} 0 0`,
                      border: 'none',
                      background: 'transparent',
                      fontFamily: tokens.font.sans,
                      color: bottomTab === t ? tokens.text.primary : tokens.text.tertiary,
                      fontSize: 11,
                      fontWeight: bottomTab === t ? 500 : 400,
                      cursor: 'pointer',
                      borderBottom: bottomTab === t ? `2px solid ${tokens.accent.teal}` : '2px solid transparent',
                      textTransform: 'capitalize',
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div style={{ flex: 1, overflow: 'auto', padding: '8px 12px' }}>
                {bottomTab === 'enzymes' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
                    {DEMO_ENZYMES.map((e) => (
                      <div
                        key={e.name}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '6px 10px',
                          borderRadius: tokens.radius.sm,
                          background: tokens.bg.surface,
                          border: `1px solid ${tokens.border.subtle}`,
                          cursor: 'pointer',
                        }}
                      >
                        <span style={{ fontSize: 11, color: tokens.accent.amber, fontFamily: tokens.font.mono, fontWeight: 500, width: 50 }}>
                          {e.name}
                        </span>
                        <span style={{ fontSize: 10, color: tokens.text.tertiary, fontFamily: tokens.font.mono }}>
                          {e.position}
                        </span>
                        <span
                          style={{
                            fontSize: 9,
                            color: tokens.text.tertiary,
                            padding: '1px 5px',
                            background: tokens.accent.amberBg,
                            borderRadius: tokens.radius.sm,
                            marginLeft: 'auto',
                          }}
                        >
                          {e.overhang}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <div
          style={{
            width: 240,
            borderLeft: `1px solid ${tokens.border.subtle}`,
            background: tokens.bg.panel,
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
            overflow: 'auto',
          }}
        >
          {/* Properties */}
          <div style={{ padding: '12px 14px' }}>
            <div style={sectionHeader}>Properties</div>
            {selectedFeature && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 10px',
                    borderRadius: tokens.radius.md,
                    background: tokens.bg.surface,
                    border: `1px solid ${tokens.border.default}`,
                  }}
                >
                  <FeatureIcon type={selectedFeature.featureType} color={selectedFeature.color} size={16} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{selectedFeature.name}</div>
                    <div style={{ fontSize: 10, color: tokens.text.tertiary, textTransform: 'capitalize' }}>
                      {selectedFeature.featureType}
                    </div>
                  </div>
                </div>
                {[
                  { label: 'Position', value: `${selectedFeature.start}..${selectedFeature.end}` },
                  { label: 'Length', value: `${selectedFeature.end - selectedFeature.start} bp` },
                  { label: 'Strand', value: selectedFeature.strand === 1 ? 'Forward (+)' : selectedFeature.strand === -1 ? 'Reverse (\u2212)' : 'None' },
                ].map((row) => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0 2px' }}>
                    <span style={{ fontSize: 11, color: tokens.text.tertiary }}>{row.label}</span>
                    <span style={{ fontSize: 11, color: tokens.text.primary, fontFamily: tokens.font.mono }}>{row.value}</span>
                  </div>
                ))}
              </div>
            )}
            {!selectedFeature && (
              <div style={{ fontSize: 11, color: tokens.text.tertiary, padding: '8px 0' }}>
                Click a feature to view properties
              </div>
            )}
          </div>

          <div style={{ height: 1, background: tokens.border.subtle, margin: '0 14px' }} />

          {/* Computed */}
          <div style={{ padding: '12px 14px' }}>
            <div style={sectionHeader}>Computed</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { label: 'GC Content', value: '51.2%', bar: 0.512, color: tokens.accent.teal },
                { label: 'Length', value: `${sequence.length.toLocaleString()} bp`, bar: 1.0, color: tokens.accent.blue },
              ].map((m) => (
                <div key={m.label} style={{ padding: '6px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: tokens.text.secondary }}>{m.label}</span>
                    <span style={{ fontSize: 11, color: tokens.text.primary, fontFamily: tokens.font.mono, fontWeight: 500 }}>{m.value}</span>
                  </div>
                  <div style={{ height: 3, background: tokens.bg.hover, borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${m.bar * 100}%`, background: m.color, borderRadius: 2, opacity: 0.6 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const sectionHeader: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: tokens.text.tertiary,
  marginBottom: 10,
};
