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

interface LabelSlot {
  angle: number;
  text: string;
  color: string;
  fontWeight: '400' | '600';
  displaced: boolean;
  displacedR: number;
}

const MIN_ZOOM = 0.8;
const MAX_ZOOM = 2.5;

/**
 * Imperative Pixi.js v8 renderer for the circular plasmid map.
 * JBrowse 2-inspired: React does NOT reconcile the Pixi scene graph.
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

    // If resize() was called during async init, apply the latest dimensions
    if (this.width !== width || this.height !== height) {
      this.app.renderer.resize(this.width, this.height);
    }

    this.attachInputListeners(canvas);
  }

  update(data: CircularMapData) {
    if (!this.initialized) return;
    this.data = data;
    this.render();
  }

  setZoomPan(zoom: number, panX: number, panY: number) {
    this.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
    this.panX = panX;
    this.panY = panY;
    if (this.data) this.render();
  }

  getZoom() { return this.zoom; }
  getPanX() { return this.panX; }
  getPanY() { return this.panY; }

  resize(width: number, height: number) {
    // Always store the latest dimensions so post-init render uses them
    this.width = width;
    this.height = height;
    if (!this.initialized || !this.app) return;
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
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    this.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.zoom + delta * this.zoom));
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
      this.isDraggingSelection = true;
      this.dragStartPosition = hit.position;
      this.emit({ type: 'backboneClick', position: hit.position });
      return;
    }

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
  /** Base radius uses the smaller dimension to keep the circle within bounds */
  private get baseR() { return Math.min(this.width, this.height) / 2 - 60; }
  /** The center radius of the backbone ring, used for all arcs */
  private get midR() { return this.baseR * this.zoom; }
  private get trackWidth() { return 20; }

  private angleFor(position: number): number {
    if (!this.data) return 0;
    return (position / this.data.sequence.length) * Math.PI * 2 - Math.PI / 2;
  }

  private pixelToPosition(x: number, y: number): number | null {
    if (!this.data) return null;
    const dx = x - this.cx;
    const dy = y - this.cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < this.midR - this.trackWidth * 2 || dist > this.midR + this.trackWidth * 2) {
      return null;
    }

    let angle = Math.atan2(dy, dx) + Math.PI / 2;
    if (angle < 0) angle += Math.PI * 2;
    return Math.round((angle / (Math.PI * 2)) * this.data.sequence.length) % this.data.sequence.length;
  }

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
    const tolerance = this.trackWidth / 2 + 5;

    if (dist < this.midR - tolerance || dist > this.midR + tolerance) {
      return { type: 'background' };
    }

    let angle = Math.atan2(dy, dx) + Math.PI / 2;
    if (angle < 0) angle += Math.PI * 2;
    const pos = (angle / (Math.PI * 2)) * this.data.sequence.length;

    for (const feat of this.data.sequence.features) {
      if (pos >= feat.start && pos <= feat.end) {
        return { type: 'feature', featureId: feat.id, position: Math.round(pos) };
      }
    }

    return { type: 'backbone', position: Math.round(pos) % this.data.sequence.length };
  }

  hitTest(x: number, y: number): string | null {
    const result = this.hitTestDetailed(x, y);
    return result.type === 'feature' ? result.featureId ?? null : null;
  }

  // ── Rendering ──

  private render() {
    if (!this.data || !this.container) return;
    const { sequence, enzymes, selectedFeatureId, selection } = this.data;

    this.clearAll();

    this.drawBackbone();
    this.drawTickMarks(sequence.length);
    this.drawSelectionHighlight(selection);
    this.drawFeatures(sequence.features, selectedFeatureId ?? null);
    if (enzymes) this.drawEnzymes(enzymes);
    this.drawLabels(sequence.features, selectedFeatureId ?? null);
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
    // Draw backbone as stroked circle — all feature arcs use the same midR
    g.circle(this.cx, this.cy, this.midR);
    g.stroke({ width: this.trackWidth, color: this.hexToNum(tokens.border.default) });
    this.backboneLayer.addChild(g);
  }

  private drawTickMarks(totalLength: number) {
    const g = new Graphics();
    const outerEdge = this.midR + this.trackWidth / 2;

    for (let i = 0; i < totalLength; i += 500) {
      const a = this.angleFor(i);
      const r1 = outerEdge + 2;
      const r2 = outerEdge + (i % 1000 === 0 ? 10 : 6);

      g.moveTo(this.cx + r1 * Math.cos(a), this.cy + r1 * Math.sin(a));
      g.lineTo(this.cx + r2 * Math.cos(a), this.cy + r2 * Math.sin(a));
      g.stroke({ width: 1, color: this.hexToNum(tokens.border.strong) });

      if (i % 1000 === 0) {
        const r3 = outerEdge + 20;
        const label = i === 0 ? totalLength.toString() : i.toString();
        const text = new Text({
          text: label,
          style: new TextStyle({
            fontSize: 10,
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

    // Extend arcs slightly so adjacent features overlap and eliminate gaps
    const angPerBp = (Math.PI * 2) / this.data.sequence.length;
    const pad = angPerBp * 0.5; // half a base-pair of angular padding
    const startAngle = this.angleFor(feat.start) - pad;
    const endAngle = this.angleFor(feat.end) + pad;
    const color = this.hexToNum(feat.color);

    // All arcs use the exact same midR as the backbone
    const hoverExtra = isHovered && !isSelected ? 4 : 0;
    const arcWidth = (isSelected ? this.trackWidth + 4 : this.trackWidth) + hoverExtra;

    const g = new Graphics();
    g.arc(this.cx, this.cy, this.midR, startAngle, endAngle);
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
      glow.arc(this.cx, this.cy, this.midR, startAngle, endAngle);
      glow.stroke({
        width: this.trackWidth + 14,
        color,
        alpha: 0.1,
        cap: 'butt',
      });
      this.selectionLayer.addChild(glow);
    }

    // Direction arrow
    if (feat.strand !== 0) {
      const arrowAngle = feat.strand === 1 ? endAngle - 0.02 : startAngle + 0.02;
      const da = feat.strand === 1 ? 0.03 : -0.03;
      const arrowSize = 5;

      const arrow = new Graphics();
      arrow.moveTo(
        this.cx + this.midR * Math.cos(arrowAngle),
        this.cy + this.midR * Math.sin(arrowAngle)
      );
      arrow.lineTo(
        this.cx + (this.midR - arrowSize) * Math.cos(arrowAngle - da),
        this.cy + (this.midR - arrowSize) * Math.sin(arrowAngle - da)
      );
      arrow.lineTo(
        this.cx + (this.midR + arrowSize) * Math.cos(arrowAngle - da),
        this.cy + (this.midR + arrowSize) * Math.sin(arrowAngle - da)
      );
      arrow.closePath();
      arrow.fill({ color, alpha: 0.9 });
      this.featureLayer.addChild(arrow);
    }
  }

  /**
   * Draw labels with simple displacement to avoid overlaps.
   * Labels are placed inside the ring. If two labels would overlap,
   * the later one is pushed further inward with a leader line.
   */
  private drawLabels(features: FeatureDto[], selectedId: string | null) {
    const innerEdge = this.midR - this.trackWidth / 2;
    const baseLabelR = innerEdge - 16;
    const minLabelGap = 14; // minimum pixel gap between label centers

    // Build label slots sorted by angle
    const slots: LabelSlot[] = features.map((feat) => {
      const startAngle = this.angleFor(feat.start);
      const endAngle = this.angleFor(feat.end);
      const midAngle = (startAngle + endAngle) / 2;
      const isSelected = feat.id === selectedId;
      return {
        angle: midAngle,
        text: feat.name,
        color: isSelected ? feat.color : tokens.text.secondary,
        fontWeight: isSelected ? '600' : '400',
        displaced: false,
        displacedR: baseLabelR,
      };
    });

    // Sort by angle for overlap detection
    slots.sort((a, b) => a.angle - b.angle);

    // Detect and resolve overlaps by pushing labels inward
    for (let i = 1; i < slots.length; i++) {
      const prev = slots[i - 1];
      const curr = slots[i];

      // Approximate pixel distance between label positions on the circle
      const angleDiff = Math.abs(curr.angle - prev.angle);
      const arcDist = angleDiff * prev.displacedR;

      if (arcDist < minLabelGap) {
        // Push this label further inward
        curr.displaced = true;
        curr.displacedR = prev.displacedR - 18;
      }
    }

    // Draw labels and leader lines
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const labelR = slot.displacedR;

      const text = new Text({
        text: slot.text,
        style: new TextStyle({
          fontSize: 11,
          fontFamily: 'DM Sans, sans-serif',
          fontWeight: slot.fontWeight,
          fill: slot.color,
        }),
      });
      text.anchor.set(0.5, 0.5);
      text.x = this.cx + labelR * Math.cos(slot.angle);
      text.y = this.cy + labelR * Math.sin(slot.angle);

      // Rotate to follow curve
      let rotation = slot.angle + Math.PI / 2;
      if (rotation > Math.PI / 2 && rotation < (3 * Math.PI) / 2) {
        rotation += Math.PI;
      }
      text.rotation = rotation;
      this.labelLayer.addChild(text);

      // Draw leader line from feature arc to displaced label
      if (slot.displaced) {
        const line = new Graphics();
        const lineStartR = innerEdge - 4;
        const lineEndR = labelR + 8;

        line.moveTo(
          this.cx + lineStartR * Math.cos(slot.angle),
          this.cy + lineStartR * Math.sin(slot.angle)
        );
        line.lineTo(
          this.cx + lineEndR * Math.cos(slot.angle),
          this.cy + lineEndR * Math.sin(slot.angle)
        );
        line.stroke({
          width: 0.5,
          color: this.hexToNum(tokens.border.strong),
          alpha: 0.4,
        });
        this.labelLayer.addChild(line);
      }
    }
  }

  private drawEnzymes(enzymes: EnzymeDto[]) {
    const outerEdge = this.midR + this.trackWidth / 2;

    for (const enzyme of enzymes) {
      const a = this.angleFor(enzyme.position);
      const r1 = outerEdge + 2;
      const r2 = outerEdge + 14;
      const color = this.hexToNum(tokens.accent.amber);

      const line = new Graphics();
      line.moveTo(this.cx + r1 * Math.cos(a), this.cy + r1 * Math.sin(a));
      line.lineTo(this.cx + r2 * Math.cos(a), this.cy + r2 * Math.sin(a));
      line.stroke({ width: 1.5, color });
      this.enzymeLayer.addChild(line);

      const r3 = outerEdge + 26;
      const text = new Text({
        text: enzyme.name,
        style: new TextStyle({
          fontSize: 10,
          fontFamily: tokens.font.mono,
          fill: tokens.accent.amber,
        }),
      });
      text.anchor.set(0.5, 0.5);
      text.alpha = 0.7;
      text.x = this.cx + r3 * Math.cos(a);
      text.y = this.cy + r3 * Math.sin(a);

      let rotation = a;
      if (a > Math.PI / 2 || a < -Math.PI / 2) {
        rotation += Math.PI;
      }
      text.rotation = rotation;
      this.enzymeLayer.addChild(text);
    }
  }

  private drawSelectionHighlight(selection: SelectionRange | null | undefined) {
    if (!selection) return;

    const startAngle = this.angleFor(selection.start);
    const endAngle = this.angleFor(selection.end);

    const g = new Graphics();
    g.arc(this.cx, this.cy, this.midR, startAngle, endAngle);
    g.stroke({
      width: this.trackWidth + 6,
      color: this.hexToNum(tokens.accent.teal),
      alpha: 0.15,
      cap: 'butt',
    });
    this.selectionLayer.addChild(g);
  }

  private drawCenterText(sequence: SequenceDto) {
    const nameText = new Text({
      text: sequence.name,
      style: new TextStyle({
        fontSize: 16,
        fontFamily: 'DM Sans, sans-serif',
        fontWeight: '600',
        fill: tokens.text.primary,
      }),
    });
    nameText.anchor.set(0.5, 0.5);
    nameText.x = this.cx;
    nameText.y = this.cy - 14;
    this.centerLayer.addChild(nameText);

    const bpText = new Text({
      text: `${sequence.length.toLocaleString()} bp`,
      style: new TextStyle({
        fontSize: 12,
        fontFamily: tokens.font.mono,
        fill: tokens.text.tertiary,
      }),
    });
    bpText.anchor.set(0.5, 0.5);
    bpText.x = this.cx;
    bpText.y = this.cy + 6;
    this.centerLayer.addChild(bpText);

    const topoText = new Text({
      text: sequence.topology,
      style: new TextStyle({
        fontSize: 10,
        fontFamily: 'DM Sans, sans-serif',
        fill: tokens.text.tertiary,
      }),
    });
    topoText.anchor.set(0.5, 0.5);
    topoText.x = this.cx;
    topoText.y = this.cy + 22;
    this.centerLayer.addChild(topoText);
  }
}
