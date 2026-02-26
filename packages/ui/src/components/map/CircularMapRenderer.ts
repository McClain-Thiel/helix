import { Application, Graphics, Text, TextStyle, Container } from 'pixi.js';
import { tokens } from '../../theme/tokens';
import type { SequenceDto, FeatureDto, EnzymeDto } from '../../types/sequence';
import type { SelectionRange } from '../../store/selectionStore';

export interface CircularMapData {
  sequence: SequenceDto;
  enzymes?: EnzymeDto[];
  selectedFeatureId?: string | null;
  selection?: SelectionRange | null;
}

export type CircularMapEventType = 'featureClick' | 'featureHover' | 'backboneClick' | 'selectionDrag';

export interface CircularMapEvent {
  type: CircularMapEventType;
  featureId?: string | null;
  position?: number;
  selection?: SelectionRange;
}

type EventCallback = (event: CircularMapEvent) => void;

/**
 * Imperative Pixi.js v8 renderer for the circular plasmid map.
 * JBrowse 2-inspired: React does NOT reconcile the Pixi scene graph.
 * Instead, this class owns the Application and manages layers directly.
 *
 * Supports interactive zoom (scroll), pan (drag background), hover, and
 * backbone drag selection.
 */
export class CircularMapRenderer {
  private app: Application | null = null;
  private container: Container | null = null;
  private backboneLayer!: Container;
  private featureLayer!: Container;
  private enzymeLayer!: Container;
  private labelLayer!: Container;
  private selectionLayer!: Container;
  private centerLayer!: Container;
  private tickLayer!: Container;

  private data: CircularMapData | null = null;
  private width = 0;
  private height = 0;
  private initialized = false;

  // Interaction state
  private zoom = 1;
  private panX = 0;
  private panY = 0;
  private isPanning = false;
  private panStartX = 0;
  private panStartY = 0;
  private panStartPanX = 0;
  private panStartPanY = 0;
  private isDraggingSelection = false;
  private dragStartPosition = -1;
  private hoveredFeatureId: string | null = null;
  private canvas: HTMLCanvasElement | null = null;

  // Event listeners
  private listeners: EventCallback[] = [];
  private boundWheel: ((e: WheelEvent) => void) | null = null;
  private boundMouseDown: ((e: MouseEvent) => void) | null = null;
  private boundMouseMove: ((e: MouseEvent) => void) | null = null;
  private boundMouseUp: ((e: MouseEvent) => void) | null = null;
  private boundMouseLeave: ((e: MouseEvent) => void) | null = null;

  on(cb: EventCallback) {
    this.listeners.push(cb);
  }

  off(cb: EventCallback) {
    this.listeners = this.listeners.filter((l) => l !== cb);
  }

  private emit(event: CircularMapEvent) {
    for (const cb of this.listeners) cb(event);
  }

  async init(canvas: HTMLCanvasElement, width: number, height: number) {
    this.width = width;
    this.height = height;
    this.canvas = canvas;

    const app = new Application();
    await app.init({
      canvas,
      width,
      height,
      backgroundColor: tokens.bg.app,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    this.app = app;

    // Build scene graph layers (back to front)
    this.container = new Container();
    this.backboneLayer = new Container();
    this.selectionLayer = new Container();
    this.featureLayer = new Container();
    this.enzymeLayer = new Container();
    this.tickLayer = new Container();
    this.labelLayer = new Container();
    this.centerLayer = new Container();

    this.container.addChild(this.backboneLayer);
    this.container.addChild(this.selectionLayer);
    this.container.addChild(this.featureLayer);
    this.container.addChild(this.enzymeLayer);
    this.container.addChild(this.tickLayer);
    this.container.addChild(this.labelLayer);
    this.container.addChild(this.centerLayer);

    this.app.stage.addChild(this.container);
    this.initialized = true;

    this.attachInputListeners(canvas);
  }

  /** Update with new data and re-render */
  update(data: CircularMapData) {
    if (!this.initialized) return;
    this.data = data;
    this.render();
  }

  setZoomPan(zoom: number, panX: number, panY: number) {
    this.zoom = Math.max(0.5, Math.min(10, zoom));
    this.panX = panX;
    this.panY = panY;
    if (this.data) this.render();
  }

  getZoom() { return this.zoom; }
  getPanX() { return this.panX; }
  getPanY() { return this.panY; }

  resize(width: number, height: number) {
    if (!this.initialized || !this.app) return;
    this.width = width;
    this.height = height;
    this.app.renderer.resize(width, height);
    if (this.data) this.render();
  }

  destroy() {
    if (this.canvas) {
      this.detachInputListeners(this.canvas);
      this.canvas = null;
    }
    this.listeners = [];
    if (!this.initialized || !this.app) return;
    this.initialized = false;
    try {
      this.app.destroy(true);
    } catch {
      // Pixi.js v8 may throw if internal state is inconsistent
    }
    this.app = null;
    this.container = null;
  }

  // ── Input handling ──

  private attachInputListeners(canvas: HTMLCanvasElement) {
    this.boundWheel = (e: WheelEvent) => this.onWheel(e);
    this.boundMouseDown = (e: MouseEvent) => this.onMouseDown(e);
    this.boundMouseMove = (e: MouseEvent) => this.onMouseMove(e);
    this.boundMouseUp = (e: MouseEvent) => this.onMouseUp(e);
    this.boundMouseLeave = (e: MouseEvent) => this.onMouseLeave(e);

    canvas.addEventListener('wheel', this.boundWheel, { passive: false });
    canvas.addEventListener('mousedown', this.boundMouseDown);
    canvas.addEventListener('mousemove', this.boundMouseMove);
    canvas.addEventListener('mouseup', this.boundMouseUp);
    canvas.addEventListener('mouseleave', this.boundMouseLeave);
  }

  private detachInputListeners(canvas: HTMLCanvasElement) {
    if (this.boundWheel) canvas.removeEventListener('wheel', this.boundWheel);
    if (this.boundMouseDown) canvas.removeEventListener('mousedown', this.boundMouseDown);
    if (this.boundMouseMove) canvas.removeEventListener('mousemove', this.boundMouseMove);
    if (this.boundMouseUp) canvas.removeEventListener('mouseup', this.boundMouseUp);
    if (this.boundMouseLeave) canvas.removeEventListener('mouseleave', this.boundMouseLeave);
  }

  private canvasCoords(e: MouseEvent): { x: number; y: number } {
    const rect = this.canvas!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private onWheel(e: WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const newZoom = Math.max(0.5, Math.min(10, this.zoom + delta * this.zoom));
    this.zoom = newZoom;
    if (this.data) this.render();
  }

  private onMouseDown(e: MouseEvent) {
    const { x, y } = this.canvasCoords(e);
    const hit = this.hitTestDetailed(x, y);

    if (hit.type === 'feature' && hit.featureId) {
      this.emit({ type: 'featureClick', featureId: hit.featureId });
      return;
    }

    if (hit.type === 'backbone' && hit.position !== undefined) {
      // Start backbone drag selection
      this.isDraggingSelection = true;
      this.dragStartPosition = hit.position;
      this.emit({ type: 'backboneClick', position: hit.position });
      return;
    }

    // Background — start pan
    this.isPanning = true;
    this.panStartX = e.clientX;
    this.panStartY = e.clientY;
    this.panStartPanX = this.panX;
    this.panStartPanY = this.panY;
    if (this.canvas) this.canvas.style.cursor = 'grabbing';
  }

  private onMouseMove(e: MouseEvent) {
    const { x, y } = this.canvasCoords(e);

    if (this.isPanning) {
      this.panX = this.panStartPanX + (e.clientX - this.panStartX);
      this.panY = this.panStartPanY + (e.clientY - this.panStartY);
      if (this.data) this.render();
      return;
    }

    if (this.isDraggingSelection && this.data) {
      const pos = this.pixelToPosition(x, y);
      if (pos !== null) {
        const start = Math.min(this.dragStartPosition, pos);
        const end = Math.max(this.dragStartPosition, pos);
        this.emit({ type: 'selectionDrag', selection: { start, end } });
      }
      return;
    }

    // Hover detection
    const hit = this.hitTestDetailed(x, y);
    const newHover = hit.type === 'feature' ? hit.featureId ?? null : null;

    if (newHover !== this.hoveredFeatureId) {
      this.hoveredFeatureId = newHover;
      if (this.canvas) {
        this.canvas.style.cursor = newHover ? 'pointer' : 'crosshair';
      }
      if (this.data) this.render();
    }
  }

  private onMouseUp(_e: MouseEvent) {
    if (this.isPanning) {
      this.isPanning = false;
      if (this.canvas) this.canvas.style.cursor = 'crosshair';
    }
    if (this.isDraggingSelection) {
      this.isDraggingSelection = false;
    }
  }

  private onMouseLeave(_e: MouseEvent) {
    if (this.isPanning) {
      this.isPanning = false;
      if (this.canvas) this.canvas.style.cursor = 'crosshair';
    }
    if (this.isDraggingSelection) {
      this.isDraggingSelection = false;
    }
    if (this.hoveredFeatureId) {
      this.hoveredFeatureId = null;
      if (this.data) this.render();
    }
  }

  // ── Geometry helpers ──

  private get cx() { return this.width / 2 + this.panX; }
  private get cy() { return this.height / 2 + this.panY; }
  private get baseOuterR() { return Math.min(this.width, this.height) / 2 - 70; }
  private get outerR() { return this.baseOuterR * this.zoom; }
  private get trackWidth() { return 22 * this.zoom; }
  private get innerR() { return this.outerR - this.trackWidth; }

  /** Map base position to angle (0 at top, clockwise) */
  private angleFor(position: number): number {
    if (!this.data) return 0;
    return (position / this.data.sequence.length) * Math.PI * 2 - Math.PI / 2;
  }

  /** Convert pixel coordinates to sequence position, or null if off-ring */
  private pixelToPosition(x: number, y: number): number | null {
    if (!this.data) return null;
    const dx = x - this.cx;
    const dy = y - this.cy;
    const midR = this.outerR - this.trackWidth / 2;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Allow wider tolerance for selection dragging
    if (dist < midR - this.trackWidth * 2 || dist > midR + this.trackWidth * 2) {
      return null;
    }

    let angle = Math.atan2(dy, dx) + Math.PI / 2;
    if (angle < 0) angle += Math.PI * 2;
    return Math.round((angle / (Math.PI * 2)) * this.data.sequence.length) % this.data.sequence.length;
  }

  /** Hex color string to numeric color for Pixi */
  private hexToNum(hex: string): number {
    return parseInt(hex.replace('#', ''), 16);
  }

  // ── Hit testing ──

  private hitTestDetailed(x: number, y: number): {
    type: 'feature' | 'backbone' | 'background';
    featureId?: string;
    position?: number;
  } {
    if (!this.data) return { type: 'background' };

    const dx = x - this.cx;
    const dy = y - this.cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const midR = this.outerR - this.trackWidth / 2;
    const tolerance = this.trackWidth / 2 + 5;

    if (dist < midR - tolerance || dist > midR + tolerance) {
      return { type: 'background' };
    }

    // Convert to position
    let angle = Math.atan2(dy, dx) + Math.PI / 2;
    if (angle < 0) angle += Math.PI * 2;
    const pos = (angle / (Math.PI * 2)) * this.data.sequence.length;

    // Check features
    for (const feat of this.data.sequence.features) {
      if (pos >= feat.start && pos <= feat.end) {
        return { type: 'feature', featureId: feat.id, position: Math.round(pos) };
      }
    }

    return { type: 'backbone', position: Math.round(pos) % this.data.sequence.length };
  }

  /** Public hit test for feature selection (backwards compat) */
  hitTest(x: number, y: number): string | null {
    const result = this.hitTestDetailed(x, y);
    return result.type === 'feature' ? result.featureId ?? null : null;
  }

  // ── Rendering ──

  private render() {
    if (!this.data || !this.container) return;
    const { sequence, enzymes, selectedFeatureId, selection } = this.data;

    this.clearAll();

    // Apply zoom/pan to container
    this.container.x = 0;
    this.container.y = 0;

    this.drawBackbone();
    this.drawTickMarks(sequence.length);
    this.drawSelectionHighlight(selection, sequence.length);
    this.drawFeatures(sequence.features, selectedFeatureId ?? null);
    if (enzymes) this.drawEnzymes(enzymes);
    this.drawCenterText(sequence);
  }

  private clearAll() {
    this.backboneLayer.removeChildren();
    this.featureLayer.removeChildren();
    this.enzymeLayer.removeChildren();
    this.labelLayer.removeChildren();
    this.selectionLayer.removeChildren();
    this.centerLayer.removeChildren();
    this.tickLayer.removeChildren();
  }

  private drawBackbone() {
    const g = new Graphics();
    const midR = this.outerR - this.trackWidth / 2;

    g.circle(this.cx, this.cy, midR);
    g.stroke({ width: this.trackWidth, color: this.hexToNum(tokens.border.default) });

    this.backboneLayer.addChild(g);
  }

  private drawTickMarks(totalLength: number) {
    const g = new Graphics();
    // Adjust tick interval based on zoom
    const baseInterval = 500;
    const labelInterval = 1000;

    for (let i = 0; i < totalLength; i += baseInterval) {
      const a = this.angleFor(i);
      const r1 = this.outerR + 2;
      const r2 = this.outerR + (i % labelInterval === 0 ? 10 * this.zoom : 6 * this.zoom);

      g.moveTo(
        this.cx + r1 * Math.cos(a),
        this.cy + r1 * Math.sin(a)
      );
      g.lineTo(
        this.cx + r2 * Math.cos(a),
        this.cy + r2 * Math.sin(a)
      );
      g.stroke({ width: 1, color: this.hexToNum(tokens.border.strong) });

      // Position labels at labelInterval
      if (i % labelInterval === 0) {
        const r3 = this.outerR + 22 * this.zoom;
        const label = i === 0 ? totalLength.toString() : i.toString();
        const text = new Text({
          text: label,
          style: new TextStyle({
            fontSize: Math.max(8, 10 * this.zoom),
            fontFamily: tokens.font.mono,
            fill: tokens.text.tertiary,
          }),
        });
        text.anchor.set(0.5, 0.5);
        text.x = this.cx + r3 * Math.cos(a);
        text.y = this.cy + r3 * Math.sin(a);
        this.tickLayer.addChild(text);
      }
    }

    this.tickLayer.addChild(g);
  }

  private drawFeatures(features: FeatureDto[], selectedId: string | null) {
    for (const feat of features) {
      this.drawFeatureArc(feat, feat.id === selectedId, feat.id === this.hoveredFeatureId);
    }
  }

  private drawFeatureArc(feat: FeatureDto, isSelected: boolean, isHovered: boolean) {
    if (!this.data) return;

    const startAngle = this.angleFor(feat.start);
    const endAngle = this.angleFor(feat.end);
    const midR = this.outerR - this.trackWidth / 2;
    const color = this.hexToNum(feat.color);

    // Feature arc — widen on hover
    const hoverExtra = isHovered && !isSelected ? 4 * this.zoom : 0;
    const arcWidth = (isSelected ? this.trackWidth + 4 * this.zoom : this.trackWidth) + hoverExtra;

    const g = new Graphics();
    g.arc(this.cx, this.cy, midR, startAngle, endAngle);
    g.stroke({
      width: arcWidth,
      color,
      alpha: isSelected ? 1.0 : isHovered ? 0.9 : 0.75,
      cap: 'butt',
    });

    this.featureLayer.addChild(g);

    // Selection glow
    if (isSelected) {
      const glow = new Graphics();
      glow.arc(this.cx, this.cy, midR, startAngle, endAngle);
      glow.stroke({
        width: this.trackWidth + 14 * this.zoom,
        color,
        alpha: 0.1,
        cap: 'butt',
      });
      this.selectionLayer.addChild(glow);
    }

    // Direction arrow
    if (feat.strand !== 0) {
      const arrowAngle = feat.strand === 1
        ? endAngle - 0.02
        : startAngle + 0.02;
      const da = feat.strand === 1 ? 0.03 : -0.03;
      const arrowSize = 5 * this.zoom;

      const arrow = new Graphics();
      arrow.moveTo(
        this.cx + midR * Math.cos(arrowAngle),
        this.cy + midR * Math.sin(arrowAngle)
      );
      arrow.lineTo(
        this.cx + (midR - arrowSize) * Math.cos(arrowAngle - da),
        this.cy + (midR - arrowSize) * Math.sin(arrowAngle - da)
      );
      arrow.lineTo(
        this.cx + (midR + arrowSize) * Math.cos(arrowAngle - da),
        this.cy + (midR + arrowSize) * Math.sin(arrowAngle - da)
      );
      arrow.closePath();
      arrow.fill({ color, alpha: 0.9 });

      this.featureLayer.addChild(arrow);
    }

    // Label
    const midAngle = (startAngle + endAngle) / 2;
    const labelR = this.innerR - 20 * this.zoom;

    const text = new Text({
      text: feat.name,
      style: new TextStyle({
        fontSize: Math.max(8, 11 * this.zoom),
        fontFamily: 'DM Sans, sans-serif',
        fontWeight: isSelected ? '600' : '400',
        fill: isSelected ? feat.color : tokens.text.secondary,
      }),
    });
    text.anchor.set(0.5, 0.5);
    text.x = this.cx + labelR * Math.cos(midAngle);
    text.y = this.cy + labelR * Math.sin(midAngle);

    // Rotate label to follow the curve
    let rotation = midAngle + Math.PI / 2;
    if (rotation > Math.PI / 2 && rotation < (3 * Math.PI) / 2) {
      rotation += Math.PI;
    }
    text.rotation = rotation;

    this.labelLayer.addChild(text);
  }

  private drawEnzymes(enzymes: EnzymeDto[]) {
    for (const enzyme of enzymes) {
      const a = this.angleFor(enzyme.position);
      const r1 = this.outerR + 2;
      const r2 = this.outerR + 14 * this.zoom;
      const color = this.hexToNum(tokens.accent.amber);

      const line = new Graphics();
      line.moveTo(
        this.cx + r1 * Math.cos(a),
        this.cy + r1 * Math.sin(a)
      );
      line.lineTo(
        this.cx + r2 * Math.cos(a),
        this.cy + r2 * Math.sin(a)
      );
      line.stroke({ width: 1.5, color });

      this.enzymeLayer.addChild(line);

      // Enzyme label
      const r3 = this.outerR + 28 * this.zoom;
      const text = new Text({
        text: enzyme.name,
        style: new TextStyle({
          fontSize: Math.max(8, 10 * this.zoom),
          fontFamily: tokens.font.mono,
          fill: tokens.accent.amber,
        }),
      });
      text.anchor.set(0.5, 0.5);
      text.alpha = 0.7;
      text.x = this.cx + r3 * Math.cos(a);
      text.y = this.cy + r3 * Math.sin(a);

      // Rotate to follow radial
      let rotation = a;
      if (a > Math.PI / 2 || a < -Math.PI / 2) {
        rotation += Math.PI;
      }
      text.rotation = rotation;

      this.enzymeLayer.addChild(text);
    }
  }

  private drawSelectionHighlight(
    selection: SelectionRange | null | undefined,
    _totalLength: number
  ) {
    if (!selection) return;

    const startAngle = this.angleFor(selection.start);
    const endAngle = this.angleFor(selection.end);
    const midR = this.outerR - this.trackWidth / 2;

    const g = new Graphics();
    g.arc(this.cx, this.cy, midR, startAngle, endAngle);
    g.stroke({
      width: this.trackWidth + 6 * this.zoom,
      color: this.hexToNum(tokens.accent.teal),
      alpha: 0.15,
      cap: 'butt',
    });

    this.selectionLayer.addChild(g);
  }

  private drawCenterText(sequence: SequenceDto) {
    const fontSize = Math.max(10, 16 * this.zoom);
    // Plasmid name
    const nameText = new Text({
      text: sequence.name,
      style: new TextStyle({
        fontSize,
        fontFamily: 'DM Sans, sans-serif',
        fontWeight: '600',
        fill: tokens.text.primary,
      }),
    });
    nameText.anchor.set(0.5, 0.5);
    nameText.x = this.cx;
    nameText.y = this.cy - 14 * this.zoom;
    this.centerLayer.addChild(nameText);

    // Base pair count
    const bpText = new Text({
      text: `${sequence.length.toLocaleString()} bp`,
      style: new TextStyle({
        fontSize: Math.max(8, 12 * this.zoom),
        fontFamily: tokens.font.mono,
        fill: tokens.text.tertiary,
      }),
    });
    bpText.anchor.set(0.5, 0.5);
    bpText.x = this.cx;
    bpText.y = this.cy + 6 * this.zoom;
    this.centerLayer.addChild(bpText);

    // Topology
    const topoText = new Text({
      text: sequence.topology,
      style: new TextStyle({
        fontSize: Math.max(7, 10 * this.zoom),
        fontFamily: 'DM Sans, sans-serif',
        fill: tokens.text.tertiary,
      }),
    });
    topoText.anchor.set(0.5, 0.5);
    topoText.x = this.cx;
    topoText.y = this.cy + 22 * this.zoom;
    this.centerLayer.addChild(topoText);
  }
}
