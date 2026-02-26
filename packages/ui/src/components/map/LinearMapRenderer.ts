import { Application, Graphics, Text, TextStyle, Container } from 'pixi.js';
import { tokens } from '../../theme/tokens';
import type { SequenceDto, FeatureDto, EnzymeDto } from '../../types/sequence';
import type { SelectionRange } from '../../store/selectionStore';

export interface LinearMapData {
  sequence: SequenceDto;
  enzymes?: EnzymeDto[];
  selectedFeatureId?: string | null;
  selection?: SelectionRange | null;
}

export type LinearMapEventType = 'featureClick' | 'featureHover' | 'backboneClick' | 'selectionDrag';

export interface LinearMapEvent {
  type: LinearMapEventType;
  featureId?: string | null;
  position?: number;
  selection?: SelectionRange;
}

type EventCallback = (event: LinearMapEvent) => void;

/** Track row assignment for a feature */
interface TrackRow {
  feat: FeatureDto;
  row: number;
}

/**
 * Imperative Pixi.js v8 renderer for the linear plasmid map.
 * Features are packed into rows to avoid overlaps.
 * Supports zoom (scroll), pan (drag), hover, and selection.
 */
export class LinearMapRenderer {
  private app: Application | null = null;
  private container: Container | null = null;
  private backboneLayer!: Container;
  private featureLayer!: Container;
  private enzymeLayer!: Container;
  private labelLayer!: Container;
  private selectionLayer!: Container;
  private tickLayer!: Container;

  private data: LinearMapData | null = null;
  private width = 0;
  private height = 0;
  private initialized = false;

  // Layout constants
  private readonly MARGIN_LEFT = 50;
  private readonly MARGIN_RIGHT = 50;
  private readonly BACKBONE_Y = 0; // computed dynamically
  private readonly TRACK_HEIGHT = 24;
  private readonly TRACK_GAP = 3;
  private readonly TICK_HEIGHT = 8;

  // Interaction state
  private zoom = 1;
  private panX = 0;
  private isPanning = false;
  private panStartMouseX = 0;
  private panStartPanX = 0;
  private isDraggingSelection = false;
  private dragStartPosition = -1;
  private hoveredFeatureId: string | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private trackRows: TrackRow[] = [];

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

  private emit(event: LinearMapEvent) {
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

    this.container.addChild(this.backboneLayer);
    this.container.addChild(this.selectionLayer);
    this.container.addChild(this.featureLayer);
    this.container.addChild(this.enzymeLayer);
    this.container.addChild(this.tickLayer);
    this.container.addChild(this.labelLayer);

    this.app.stage.addChild(this.container);
    this.initialized = true;

    // If resize() was called during async init, apply the latest dimensions
    if (this.width !== width || this.height !== height) {
      this.app.renderer.resize(this.width, this.height);
    }

    this.attachInputListeners(canvas);
  }

  update(data: LinearMapData) {
    if (!this.initialized) return;
    this.data = data;
    this.trackRows = this.packTracks(data.sequence.features);
    this.render();
  }

  resize(width: number, height: number) {
    // Always store the latest dimensions so post-init render uses them
    this.width = width;
    this.height = height;
    if (!this.initialized || !this.app) return;
    this.app.renderer.resize(width, height);
    if (this.data) this.render();
  }

  getZoom() { return this.zoom; }
  getPanX() { return this.panX; }

  setZoomPan(zoom: number, panX: number) {
    this.zoom = Math.max(0.5, Math.min(20, zoom));
    this.panX = panX;
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
      // Pixi.js v8 may throw
    }
    this.app = null;
    this.container = null;
  }

  // ── Track packing ──

  private packTracks(features: FeatureDto[]): TrackRow[] {
    const sorted = [...features].sort((a, b) => a.start - b.start);
    const rowEnds: number[] = []; // tracks the end position of each row
    const result: TrackRow[] = [];

    for (const feat of sorted) {
      let placed = false;
      for (let r = 0; r < rowEnds.length; r++) {
        if (feat.start >= rowEnds[r]) {
          rowEnds[r] = feat.end;
          result.push({ feat, row: r });
          placed = true;
          break;
        }
      }
      if (!placed) {
        rowEnds.push(feat.end);
        result.push({ feat, row: rowEnds.length - 1 });
      }
    }

    return result;
  }

  // ── Geometry helpers ──

  private get trackAreaWidth() {
    return (this.width - this.MARGIN_LEFT - this.MARGIN_RIGHT) * this.zoom;
  }

  private get maxRows() {
    const maxRow = this.trackRows.reduce((m, tr) => Math.max(m, tr.row), 0);
    return maxRow + 1;
  }

  private get backboneY() {
    // Center the backbone + tracks vertically
    const totalTrackHeight = this.maxRows * (this.TRACK_HEIGHT + this.TRACK_GAP);
    return this.height / 2 - totalTrackHeight / 2 - 15;
  }

  /** Convert sequence position to x pixel coordinate */
  private posToX(position: number): number {
    if (!this.data) return 0;
    return this.MARGIN_LEFT + this.panX + (position / this.data.sequence.length) * this.trackAreaWidth;
  }

  /** Convert x pixel coordinate to sequence position */
  private xToPos(x: number): number | null {
    if (!this.data) return null;
    const relX = x - this.MARGIN_LEFT - this.panX;
    if (relX < 0 || relX > this.trackAreaWidth) return null;
    return Math.round((relX / this.trackAreaWidth) * this.data.sequence.length) % this.data.sequence.length;
  }

  private hexToNum(hex: string): number {
    return parseInt(hex.replace('#', ''), 16);
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
    const { x } = this.canvasCoords(e);

    // Zoom toward cursor position
    const oldZoom = this.zoom;
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    this.zoom = Math.max(0.5, Math.min(20, this.zoom + delta * this.zoom));

    // Adjust panX so the position under the cursor stays stable
    const ratio = this.zoom / oldZoom;
    const relX = x - this.MARGIN_LEFT - this.panX;
    this.panX = this.panX - relX * (ratio - 1);

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

    // Background pan
    this.isPanning = true;
    this.panStartMouseX = e.clientX;
    this.panStartPanX = this.panX;
    if (this.canvas) this.canvas.style.cursor = 'grabbing';
  }

  private onMouseMove(e: MouseEvent) {
    const { x, y } = this.canvasCoords(e);

    if (this.isPanning) {
      this.panX = this.panStartPanX + (e.clientX - this.panStartMouseX);
      if (this.data) this.render();
      return;
    }

    if (this.isDraggingSelection) {
      const pos = this.xToPos(x);
      if (pos !== null) {
        const start = Math.min(this.dragStartPosition, pos);
        const end = Math.max(this.dragStartPosition, pos);
        this.emit({ type: 'selectionDrag', selection: { start, end } });
      }
      return;
    }

    // Hover
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
    this.isPanning = false;
    this.isDraggingSelection = false;
    if (this.canvas) this.canvas.style.cursor = 'crosshair';
  }

  private onMouseLeave(_e: MouseEvent) {
    this.isPanning = false;
    this.isDraggingSelection = false;
    if (this.canvas) this.canvas.style.cursor = 'crosshair';
    if (this.hoveredFeatureId) {
      this.hoveredFeatureId = null;
      if (this.data) this.render();
    }
  }

  // ── Hit testing ──

  private hitTestDetailed(x: number, y: number): {
    type: 'feature' | 'backbone' | 'background';
    featureId?: string;
    position?: number;
  } {
    if (!this.data) return { type: 'background' };

    // Check features first
    for (const { feat, row } of this.trackRows) {
      const fx = this.posToX(feat.start);
      const fw = this.posToX(feat.end) - fx;
      const fy = this.backboneY + 20 + row * (this.TRACK_HEIGHT + this.TRACK_GAP);

      if (x >= fx && x <= fx + fw && y >= fy && y <= fy + this.TRACK_HEIGHT) {
        return { type: 'feature', featureId: feat.id };
      }
    }

    // Check backbone region
    if (y >= this.backboneY - 10 && y <= this.backboneY + 10) {
      const pos = this.xToPos(x);
      if (pos !== null) {
        return { type: 'backbone', position: pos };
      }
    }

    return { type: 'background' };
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
    this.drawBackbone(sequence.length);
    this.drawTickMarks(sequence.length);
    this.drawSelectionHighlight(selection);
    this.drawFeatures(selectedFeatureId ?? null);
    if (enzymes) this.drawEnzymes(enzymes);
  }

  private clearAll() {
    this.backboneLayer.removeChildren();
    this.featureLayer.removeChildren();
    this.enzymeLayer.removeChildren();
    this.labelLayer.removeChildren();
    this.selectionLayer.removeChildren();
    this.tickLayer.removeChildren();
  }

  private drawBackbone(totalLength: number) {
    const g = new Graphics();
    const x1 = this.posToX(0);
    const x2 = this.posToX(totalLength);
    const y = this.backboneY;

    g.moveTo(x1, y);
    g.lineTo(x2, y);
    g.stroke({ width: 4, color: this.hexToNum(tokens.border.default) });

    // Endpoints
    g.circle(x1, y, 4);
    g.fill({ color: this.hexToNum(tokens.border.strong) });
    g.circle(x2, y, 4);
    g.fill({ color: this.hexToNum(tokens.border.strong) });

    this.backboneLayer.addChild(g);

    // Start/end labels
    const startLabel = new Text({
      text: '1',
      style: new TextStyle({
        fontSize: 9,
        fontFamily: tokens.font.mono,
        fill: tokens.text.tertiary,
      }),
    });
    startLabel.anchor.set(0.5, 1);
    startLabel.x = x1;
    startLabel.y = y - 12;
    this.tickLayer.addChild(startLabel);

    const endLabel = new Text({
      text: totalLength.toString(),
      style: new TextStyle({
        fontSize: 9,
        fontFamily: tokens.font.mono,
        fill: tokens.text.tertiary,
      }),
    });
    endLabel.anchor.set(0.5, 1);
    endLabel.x = x2;
    endLabel.y = y - 12;
    this.tickLayer.addChild(endLabel);
  }

  private drawTickMarks(totalLength: number) {
    const g = new Graphics();
    const y = this.backboneY;

    // Adaptive tick interval based on zoom
    let interval = 1000;
    if (this.zoom > 3) interval = 500;
    if (this.zoom > 8) interval = 100;

    for (let i = interval; i < totalLength; i += interval) {
      const x = this.posToX(i);
      const isMajor = i % (interval * 2) === 0;

      g.moveTo(x, y - (isMajor ? this.TICK_HEIGHT : this.TICK_HEIGHT / 2));
      g.lineTo(x, y);
      g.stroke({ width: 1, color: this.hexToNum(tokens.border.strong) });

      if (isMajor) {
        const label = new Text({
          text: i.toLocaleString(),
          style: new TextStyle({
            fontSize: 9,
            fontFamily: tokens.font.mono,
            fill: tokens.text.tertiary,
          }),
        });
        label.anchor.set(0.5, 1);
        label.x = x;
        label.y = y - this.TICK_HEIGHT - 2;
        this.tickLayer.addChild(label);
      }
    }

    this.tickLayer.addChild(g);
  }

  private drawSelectionHighlight(selection: SelectionRange | null | undefined) {
    if (!selection) return;

    const x1 = this.posToX(selection.start);
    const x2 = this.posToX(selection.end);
    const y = this.backboneY;
    const totalHeight = 20 + this.maxRows * (this.TRACK_HEIGHT + this.TRACK_GAP);

    const g = new Graphics();
    g.rect(x1, y - 10, x2 - x1, totalHeight);
    g.fill({ color: this.hexToNum(tokens.accent.teal), alpha: 0.08 });

    // Selection boundary lines
    g.moveTo(x1, y - 10);
    g.lineTo(x1, y + totalHeight - 10);
    g.stroke({ width: 1, color: this.hexToNum(tokens.accent.teal), alpha: 0.4 });

    g.moveTo(x2, y - 10);
    g.lineTo(x2, y + totalHeight - 10);
    g.stroke({ width: 1, color: this.hexToNum(tokens.accent.teal), alpha: 0.4 });

    this.selectionLayer.addChild(g);
  }

  private drawFeatures(selectedId: string | null) {
    for (const { feat, row } of this.trackRows) {
      this.drawFeatureRect(feat, row, feat.id === selectedId, feat.id === this.hoveredFeatureId);
    }
  }

  private drawFeatureRect(feat: FeatureDto, row: number, isSelected: boolean, isHovered: boolean) {
    const x = this.posToX(feat.start);
    const w = Math.max(this.posToX(feat.end) - x, 4); // minimum 4px wide
    const y = this.backboneY + 20 + row * (this.TRACK_HEIGHT + this.TRACK_GAP);
    const h = this.TRACK_HEIGHT;
    const color = this.hexToNum(feat.color);

    const g = new Graphics();

    // Feature body
    g.roundRect(x, y, w, h, 4);
    g.fill({ color, alpha: isSelected ? 1.0 : isHovered ? 0.9 : 0.7 });

    // Selection outline
    if (isSelected) {
      g.roundRect(x - 2, y - 2, w + 4, h + 4, 5);
      g.stroke({ width: 2, color: this.hexToNum(tokens.text.primary), alpha: 0.8 });
    }

    // Hover outline
    if (isHovered && !isSelected) {
      g.roundRect(x - 1, y - 1, w + 2, h + 2, 4);
      g.stroke({ width: 1, color, alpha: 0.5 });
    }

    this.featureLayer.addChild(g);

    // Direction arrow inside the rect
    if (feat.strand !== 0 && w > 20) {
      const arrowG = new Graphics();
      const arrowX = feat.strand === 1 ? x + w - 8 : x + 8;
      const arrowDir = feat.strand === 1 ? 1 : -1;

      arrowG.moveTo(arrowX, y + h / 2 - 4);
      arrowG.lineTo(arrowX + 6 * arrowDir, y + h / 2);
      arrowG.lineTo(arrowX, y + h / 2 + 4);
      arrowG.stroke({ width: 1.5, color: 0xffffff, alpha: 0.7 });

      this.featureLayer.addChild(arrowG);
    }

    // Label (only if wide enough)
    if (w > 30) {
      const text = new Text({
        text: feat.name,
        style: new TextStyle({
          fontSize: 10,
          fontFamily: 'DM Sans, sans-serif',
          fontWeight: isSelected ? '600' : '400',
          fill: '#ffffff',
        }),
      });
      text.anchor.set(0, 0.5);
      text.x = x + 6;
      text.y = y + h / 2;

      // Clip label to feature width
      if (text.width > w - 20) {
        text.width = w - 20;
      }

      this.labelLayer.addChild(text);
    }
  }

  private drawEnzymes(enzymes: EnzymeDto[]) {
    for (const enzyme of enzymes) {
      const x = this.posToX(enzyme.position);
      const y = this.backboneY;
      const color = this.hexToNum(tokens.accent.amber);

      const line = new Graphics();
      line.moveTo(x, y - 14);
      line.lineTo(x, y);
      line.stroke({ width: 1.5, color });

      this.enzymeLayer.addChild(line);

      // Label
      const text = new Text({
        text: enzyme.name,
        style: new TextStyle({
          fontSize: 9,
          fontFamily: tokens.font.mono,
          fill: tokens.accent.amber,
        }),
      });
      text.anchor.set(0.5, 1);
      text.alpha = 0.7;
      text.x = x;
      text.y = y - 16;
      text.rotation = -0.5;

      this.enzymeLayer.addChild(text);
    }
  }
}
