import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  tokens,
  useEditorStore,
  useActiveSequence,
  useActiveTab,
  useSelectionStore,
  useViewStore,
  SequenceView,
  CircularMap,
  LinearMap,
  FeatureIcon,
} from '@helix/ui';
import type { SequenceDto, OpenFileResult } from '@helix/ui';

export default function App() {
  const openSequence = useEditorStore((s) => s.openSequence);
  const tabs = useEditorStore((s) => s.tabs);
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const setActiveTab = useEditorStore((s) => s.setActiveTab);
  const closeTab = useEditorStore((s) => s.closeTab);
  const activeSeq = useActiveSequence();
  const activeTab = useActiveTab();
  const selectionStore = useSelectionStore();
  const { selectedFeatureId, selectFeature, clearSelection } = selectionStore;

  const [activeView, setActiveView] = useState<'map' | 'linear' | 'sequence'>('map');
  const [bottomTab, setBottomTab] = useState('features');
  const editorAreaRef = useRef<HTMLDivElement>(null);
  const [editorSize, setEditorSize] = useState({ width: 0, height: 0 });
  const [error, setError] = useState<string | null>(null);
  const [showPlusMenu, setShowPlusMenu] = useState(false);

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

  // Clear selection on tab switch
  useEffect(() => {
    clearSelection();
  }, [activeTabId, clearSelection]);

  // Open file via Tauri dialog
  const handleOpenFile = useCallback(async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const path = await open({
        filters: [
          { name: 'Sequence Files', extensions: ['gb', 'gbk', 'genbank', 'fasta', 'fa', 'fna'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });
      if (path && typeof path === 'string') {
        const { invoke } = await import('@tauri-apps/api/core');
        const result = await invoke<OpenFileResult>('open_sequence_file', { path });
        for (const seq of result.sequences) {
          openSequence(seq, { filePath: result.filePath, fileFormat: result.format });
        }
        setError(null);
      }
    } catch (e) {
      const msg = String(e);
      if (msg.includes('cancelled') || msg.includes('user abort')) return;
      setError(msg);
      console.error('File open failed:', e);
    }
  }, [openSequence]);

  // Create new blank sequence
  const handleNewSequence = useCallback(() => {
    const id = `seq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const newSeq: SequenceDto = {
      id,
      name: 'Untitled',
      description: '',
      topology: 'circular',
      sequence: '',
      length: 0,
      features: [],
    };
    openSequence(newSeq);
  }, [openSequence]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // Cmd+O / Ctrl+O — open file
      if ((e.metaKey || e.ctrlKey) && e.code === 'KeyO') {
        e.preventDefault();
        handleOpenFile();
        return;
      }
      // Cmd+N / Ctrl+N — new sequence
      if ((e.metaKey || e.ctrlKey) && e.code === 'KeyN') {
        e.preventDefault();
        handleNewSequence();
        return;
      }
      // Cmd+W / Ctrl+W — close active tab
      if ((e.metaKey || e.ctrlKey) && e.code === 'KeyW') {
        e.preventDefault();
        if (activeTabId) closeTab(activeTabId);
        return;
      }
      // Space — toggle map/linear
      if (e.code === 'Space' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setActiveView((v) => v === 'map' ? 'linear' : v === 'linear' ? 'map' : v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleOpenFile, handleNewSequence, activeTabId, closeTab]);

  // ── Welcome screen (no tabs open) ──
  if (tabs.length === 0) {
    return (
      <div
        style={{
          width: '100%',
          height: '100vh',
          background: tokens.bg.app,
          color: tokens.text.primary,
          fontFamily: tokens.font.sans,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 24,
          userSelect: 'none',
        }}
      >
        <svg width="48" height="48" viewBox="0 0 20 20" fill="none">
          <path d="M10 2C6 2 4 5 4 10s2 8 6 8 6-3 6-8-2-8-6-8z" stroke={tokens.accent.teal} strokeWidth="1.5" fill="none" />
          <path d="M6.5 6.5Q10 9 13.5 6.5M6.5 10Q10 13 13.5 10M6.5 13.5Q10 16 13.5 13.5" stroke={tokens.accent.teal} strokeWidth="1" opacity="0.6" />
        </svg>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: tokens.font.display, fontWeight: 600, fontSize: 22, marginBottom: 6 }}>
            Helix
          </div>
          <div style={{ fontSize: 13, color: tokens.text.tertiary }}>
            Molecular cloning & sequence design
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <button onClick={handleOpenFile} style={welcomeButton}>
            Open File
            <span style={shortcutHint}>{navigator.platform.includes('Mac') ? '\u2318' : 'Ctrl+'}O</span>
          </button>
          <button onClick={handleNewSequence} style={{ ...welcomeButton, background: tokens.bg.surface, borderColor: tokens.border.default }}>
            New Sequence
            <span style={shortcutHint}>{navigator.platform.includes('Mac') ? '\u2318' : 'Ctrl+'}N</span>
          </button>
        </div>
        {error && (
          <div style={{ color: '#ef6b6b', fontSize: 12, maxWidth: 400, textAlign: 'center', marginTop: 8 }}>
            {error}
          </div>
        )}
        <div style={{ fontSize: 11, color: tokens.text.tertiary, marginTop: 16 }}>
          Supports GenBank (.gb, .gbk) and FASTA (.fasta, .fa) files
        </div>
      </div>
    );
  }

  // ── Editor layout ──
  const sequence = activeSeq;
  const selectedFeature = sequence?.features.find((f) => f.id === selectedFeatureId);

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

        {/* Tab bar — driven by store */}
        <div style={{ display: 'flex', gap: 2, flex: 1, overflow: 'hidden' }}>
          {tabs.map((tab) => (
            <div
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '5px 10px',
                paddingRight: 6,
                borderRadius: tokens.radius.md,
                fontSize: 12,
                fontWeight: activeTabId === tab.id ? 500 : 400,
                background: activeTabId === tab.id ? tokens.bg.surface : 'transparent',
                color: activeTabId === tab.id ? tokens.text.primary : tokens.text.tertiary,
                border: activeTabId === tab.id ? `1px solid ${tokens.border.default}` : '1px solid transparent',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
                flexShrink: 0,
                maxWidth: 180,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: tokens.accent.teal,
                  opacity: 0.6,
                  flexShrink: 0,
                }}
              />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {tab.name}
              </span>
              {tab.isDirty && (
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: tokens.text.tertiary, flexShrink: 0 }} />
              )}
              <span
                onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                style={{
                  fontSize: 14,
                  color: tokens.text.tertiary,
                  cursor: 'pointer',
                  padding: '0 2px',
                  lineHeight: 1,
                  flexShrink: 0,
                  opacity: 0.5,
                }}
              >
                ×
              </span>
            </div>
          ))}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div
              onClick={() => setShowPlusMenu((v) => !v)}
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
            {showPlusMenu && (
              <>
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                  onClick={() => setShowPlusMenu(false)}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: 4,
                    background: tokens.bg.surface,
                    border: `1px solid ${tokens.border.default}`,
                    borderRadius: tokens.radius.md,
                    padding: 4,
                    zIndex: 100,
                    minWidth: 160,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  }}
                >
                  <div
                    onClick={() => { setShowPlusMenu(false); handleOpenFile(); }}
                    style={plusMenuItem}
                  >
                    Open File
                    <span style={{ fontSize: 10, color: tokens.text.tertiary, fontFamily: tokens.font.mono, marginLeft: 'auto' }}>
                      {navigator.platform.includes('Mac') ? '\u2318' : 'Ctrl+'}O
                    </span>
                  </div>
                  <div
                    onClick={() => { setShowPlusMenu(false); handleNewSequence(); }}
                    style={plusMenuItem}
                  >
                    New Sequence
                    <span style={{ fontSize: 10, color: tokens.text.tertiary, fontFamily: tokens.font.mono, marginLeft: 'auto' }}>
                      {navigator.platform.includes('Mac') ? '\u2318' : 'Ctrl+'}N
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Status bar */}
        {sequence && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
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
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div
          style={{
            padding: '6px 16px',
            background: '#2a1215',
            borderBottom: `1px solid #5c2025`,
            color: '#ef6b6b',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ flex: 1 }}>{error}</span>
          <span onClick={() => setError(null)} style={{ cursor: 'pointer', opacity: 0.6 }}>×</span>
        </div>
      )}

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
            {sequence && sequence.features.length > 0 ? (
              sequence.features.map((f) => (
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
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {f.name}
                  </span>
                  <span style={{ fontSize: 9, color: tokens.text.tertiary, fontFamily: tokens.font.mono }}>
                    {f.strand === -1 ? '\u25C4' : '\u25BA'}
                  </span>
                </div>
              ))
            ) : (
              <div style={{ fontSize: 11, color: tokens.text.tertiary, padding: '8px 4px' }}>
                {sequence ? 'No features annotated' : 'No file open'}
              </div>
            )}
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
              {sequence ? (
                <>
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
                </>
              ) : (
                <div style={{ color: tokens.text.tertiary, fontSize: 13 }}>
                  No sequence loaded
                </div>
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
                {['features', 'history'].map((t) => (
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
                {bottomTab === 'features' && sequence && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                    {sequence.features.map((f) => (
                      <div
                        key={f.id}
                        onClick={() => selectFeature(f.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '6px 10px',
                          borderRadius: tokens.radius.sm,
                          background: selectedFeatureId === f.id ? tokens.accent.tealBg : tokens.bg.surface,
                          border: `1px solid ${selectedFeatureId === f.id ? tokens.accent.tealBorder : tokens.border.subtle}`,
                          cursor: 'pointer',
                        }}
                      >
                        <FeatureIcon type={f.featureType} color={f.color} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {f.name}
                          </div>
                          <div style={{ fontSize: 9, color: tokens.text.tertiary, fontFamily: tokens.font.mono }}>
                            {f.start.toLocaleString()}..{f.end.toLocaleString()}
                          </div>
                        </div>
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
                  { label: 'Position', value: `${selectedFeature.start.toLocaleString()}..${selectedFeature.end.toLocaleString()}` },
                  { label: 'Length', value: `${(selectedFeature.end - selectedFeature.start).toLocaleString()} bp` },
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
            {sequence && sequence.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <ComputedRow label="GC Content" value={gcContent(sequence.sequence)} bar color={tokens.accent.teal} />
                <ComputedRow label="Length" value={`${sequence.length.toLocaleString()} bp`} />
                <ComputedRow label="Features" value={String(sequence.features.length)} />
                {activeTab?.fileFormat && (
                  <ComputedRow label="Format" value={activeTab.fileFormat.toUpperCase()} />
                )}
              </div>
            ) : (
              <div style={{ fontSize: 11, color: tokens.text.tertiary, padding: '8px 0' }}>
                No sequence loaded
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ──

function gcContent(seq: string): string {
  if (seq.length === 0) return '0%';
  let gc = 0;
  for (const c of seq) {
    if (c === 'G' || c === 'g' || c === 'C' || c === 'c') gc++;
  }
  return `${((gc / seq.length) * 100).toFixed(1)}%`;
}

function ComputedRow({ label, value, bar, color }: {
  label: string;
  value: string;
  bar?: boolean;
  color?: string;
}) {
  const numericPart = bar ? parseFloat(value) / 100 : 0;
  return (
    <div style={{ padding: '6px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: bar ? 4 : 0 }}>
        <span style={{ fontSize: 11, color: tokens.text.secondary }}>{label}</span>
        <span style={{ fontSize: 11, color: tokens.text.primary, fontFamily: tokens.font.mono, fontWeight: 500 }}>{value}</span>
      </div>
      {bar && color && (
        <div style={{ height: 3, background: tokens.bg.hover, borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${numericPart * 100}%`, background: color, borderRadius: 2, opacity: 0.6 }} />
        </div>
      )}
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

const welcomeButton: React.CSSProperties = {
  padding: '10px 20px',
  borderRadius: '8px',
  border: `1px solid ${tokens.accent.teal}`,
  background: tokens.accent.tealBg,
  color: tokens.text.primary,
  fontSize: 14,
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: tokens.font.sans,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const shortcutHint: React.CSSProperties = {
  fontSize: 10,
  color: tokens.text.tertiary,
  fontFamily: tokens.font.mono,
};

const plusMenuItem: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: 12,
  color: tokens.text.primary,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontFamily: tokens.font.sans,
};
