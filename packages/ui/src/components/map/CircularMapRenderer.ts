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

/**
 * Imperative Pixi.js v8 renderer for the circular plasmid map.
 * JBrowse 2-inspired: React does NOT reconcile the Pixi scene graph.
 * Instead, this class owns the Application and manages layers directly.
 */
export class CircularMapRenderer {
  private app: Application;
  private container: Container;
  private backboneLayer: Container;
  private featureLayer: Container;
  private enzymeLayer: Container;
  private labelLayer: Container;
  private selectionLayer: Container;
  private centerLayer: Container;
  private tickLayer: Container;

  private data: CircularMapData | null = null;
  private width = 0;
  private height = 0;
  private initialized = false;

  constructor() {
    this.app = new Application();
    this.container = new Container();
    this.backboneLayer = new Container();
    this.featureLayer = new Container();
    this.enzymeLayer = new Container();
    this.labelLayer = new Container();
    this.selectionLayer = new Container();
    this.centerLayer = new Container();
    this.tickLayer = new Container();
  }

  async init(canvas: HTMLCanvasElement, width: number, height: number) {
    this.width = width;
    this.height = height;

    await this.app.init({
      canvas,
      width,
      height,
      backgroundColor: tokens.bg.app,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    // Build scene graph layers (back to front)
    this.container.addChild(this.backboneLayer);
    this.container.addChild(this.selectionLayer);
    this.container.addChild(this.featureLayer);
    this.container.addChild(this.enzymeLayer);
    this.container.addChild(this.tickLayer);
    this.container.addChild(this.labelLayer);
    this.container.addChild(this.centerLayer);

    this.app.stage.addChild(this.container);
    this.initialized = true;
  }

  /** Update with new data and re-render */
  update(data: CircularMapData) {
    if (!this.initialized) return;
    this.data = data;
    this.render();
  }

  resize(width: number, height: number) {
    if (!this.initialized) return;
    this.width = width;
    this.height = height;
    this.app.renderer.resize(width, height);
    if (this.data) this.render();
  }

  destroy() {
    this.app.destroy(true);
  }

  // ── Geometry helpers ──

  private get cx() { return this.width / 2; }
  private get cy() { return this.height / 2; }
  private get outerR() { return Math.min(this.cx, this.cy) - 70; }
  private get trackWidth() { return 22; }
  private get innerR() { return this.outerR - this.trackWidth; }

  /** Map base position to angle (0 at top, clockwise) */
  private angleFor(position: number): number {
    if (!this.data) return 0;
    return (position / this.data.sequence.length) * Math.PI * 2 - Math.PI / 2;
  }

  /** Hex color string to numeric color for Pixi */
  private hexToNum(hex: string): number {
    return parseInt(hex.replace('#', ''), 16);
  }

  // ── Rendering ──

  private render() {
    if (!this.data) return;
    const { sequence, enzymes, selectedFeatureId, selection } = this.data;

    this.clearAll();
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

    for (let i = 0; i < totalLength; i += 500) {
      const a = this.angleFor(i);
      const r1 = this.outerR + 2;
      const r2 = this.outerR + (i % 1000 === 0 ? 10 : 6);

      g.moveTo(
        this.cx + r1 * Math.cos(a),
        this.cy + r1 * Math.sin(a)
      );
      g.lineTo(
        this.cx + r2 * Math.cos(a),
        this.cy + r2 * Math.sin(a)
      );
      g.stroke({ width: 1, color: this.hexToNum(tokens.border.strong) });

      // Position labels at 1000bp intervals
      if (i % 1000 === 0) {
        const r3 = this.outerR + 22;
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
      this.drawFeatureArc(feat, feat.id === selectedId);
    }
  }

  private drawFeatureArc(feat: FeatureDto, isSelected: boolean) {
    if (!this.data) return;

    const startAngle = this.angleFor(feat.start);
    const endAngle = this.angleFor(feat.end);
    const midR = this.outerR - this.trackWidth / 2;
    const color = this.hexToNum(feat.color);

    // Feature arc
    const g = new Graphics();
    g.arc(this.cx, this.cy, midR, startAngle, endAngle);
    g.stroke({
      width: isSelected ? this.trackWidth + 4 : this.trackWidth,
      color,
      alpha: isSelected ? 1.0 : 0.75,
      cap: 'butt',
    });

    this.featureLayer.addChild(g);

    // Selection glow
    if (isSelected) {
      const glow = new Graphics();
      glow.arc(this.cx, this.cy, midR, startAngle, endAngle);
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
      const arrowAngle = feat.strand === 1
        ? endAngle - 0.02
        : startAngle + 0.02;
      const da = feat.strand === 1 ? 0.03 : -0.03;
      const arrowSize = 5;

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
    const labelR = this.innerR - 20;

    const text = new Text({
      text: feat.name,
      style: new TextStyle({
        fontSize: 11,
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
      const r2 = this.outerR + 14;
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
      const r3 = this.outerR + 28;
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
    totalLength: number
  ) {
    if (!selection) return;

    const startAngle = this.angleFor(selection.start);
    const endAngle = this.angleFor(selection.end);
    const midR = this.outerR - this.trackWidth / 2;

    const g = new Graphics();
    g.arc(this.cx, this.cy, midR, startAngle, endAngle);
    g.stroke({
      width: this.trackWidth + 6,
      color: this.hexToNum(tokens.accent.teal),
      alpha: 0.15,
      cap: 'butt',
    });

    this.selectionLayer.addChild(g);
  }

  private drawCenterText(sequence: SequenceDto) {
    // Plasmid name
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

    // Base pair count
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

    // Topology
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

  /** Hit test: returns feature ID at the given pixel coordinates, or null */
  hitTest(x: number, y: number): string | null {
    if (!this.data) return null;

    const dx = x - this.cx;
    const dy = y - this.cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const midR = this.outerR - this.trackWidth / 2;

    // Check if within the track ring
    if (dist < midR - this.trackWidth / 2 - 5 || dist > midR + this.trackWidth / 2 + 5) {
      return null;
    }

    // Convert to angle
    let angle = Math.atan2(dy, dx);
    // Normalize to [0, 2PI]
    if (angle < -Math.PI / 2) angle += Math.PI * 2;

    // Convert to position
    const normalizedAngle = angle + Math.PI / 2;
    const pos =
      ((normalizedAngle < 0 ? normalizedAngle + Math.PI * 2 : normalizedAngle) /
        (Math.PI * 2)) *
      this.data.sequence.length;

    // Find feature at position
    for (const feat of this.data.sequence.features) {
      if (pos >= feat.start && pos <= feat.end) {
        return feat.id;
      }
    }

    return null;
  }
}
