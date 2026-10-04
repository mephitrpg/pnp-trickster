import { useEffect, useRef, useState } from "react";
import { lockPageScroll } from "../../scroll-lock.ts";
import { useLocalization } from "../../../LocalizationProvider.tsx";
import { validCorners } from "../utils/geometry.ts";
import type { Sprite } from "../logic/model.ts";
import type { EditedRegion } from "../logic/useCardPrinter.ts";

type Point = { x: number; y: number };
export function DetectionEditor({ sprite, onSave, onClose }: { sprite: Sprite; onSave: (areas: EditedRegion[]) => Promise<void>; onClose: () => void }) {
  const { t } = useLocalization();
  const dialog = useRef<HTMLDialogElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const dragging = useRef<{ corner: number; pointerId: number } | null>(null);
  const [regions, setRegions] = useState<EditedRegion[]>(() => (sprite.detectedRegions || []).map(({ corners }, originalIndex) => ({ originalIndex, corners: corners.map((point) => ({ ...point })) })));
  const [selected, setSelected] = useState(regions.length ? 0 : -1);
  const [zoom, setZoom] = useState(1);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const width = sprite.image.naturalWidth, height = sprite.image.naturalHeight;
  useEffect(() => {
    const node = dialog.current!;
    node.showModal();
    const unlock = lockPageScroll(node);
    const measureViewport = () => {
      const bounds = viewport.current?.getBoundingClientRect();
      if (!bounds) return;
      // Scrollbars change clientWidth/clientHeight, but not the outer size. Leave
      // one pixel for subpixel rounding when the image fits the viewport.
      const next = { width: Math.max(0, bounds.width - 1), height: Math.max(0, bounds.height - 1) };
      setViewportSize((current) => current.width === next.width && current.height === next.height ? current : next);
    };
    const observer = new ResizeObserver(measureViewport);
    observer.observe(viewport.current!, { box: "border-box" });
    measureViewport();
    return () => { observer.disconnect(); unlock(); node.close(); };
  }, []);
  const scale = width / (svg.current?.getBoundingClientRect().width || width);
  const baseWidth = Math.min(width, viewportSize.width || width, (viewportSize.height || height) * width / height);
  const moveCorner = (corner: number, point: Point) => {
    if (selected < 0) return;
    const next = regions.map((entry) => ({ ...entry, corners: entry.corners.map((value) => ({ ...value })) }));
    next[selected].corners[corner] = { x: Math.max(0, Math.min(width - 1, point.x)), y: Math.max(0, Math.min(height - 1, point.y)) };
    if (validCorners(next[selected].corners)) setRegions(next);
  };
  const removeSelected = () => {
    if (busy || selected < 0) return;
    dragging.current = null;
    const next = regions.filter((_, index) => index !== selected);
    setRegions(next); setSelected(Math.min(selected, next.length - 1));
  };
  const changeZoom = (delta: number) => setZoom((value) => Math.max(.5, Math.min(4, Math.round((value + delta) * 10) / 10)));
  const close = () => { if (!busy) { dialog.current?.close(); onClose(); } };
  return <dialog ref={dialog} className="detection-editor" aria-labelledby="detection-editor-title" aria-busy={busy}
    onCancel={(event) => { event.preventDefault(); close(); }} onClose={onClose}
    onKeyDown={(event) => {
      if (busy || selected < 0 || event.nativeEvent.isComposing || !["Delete", "Backspace"].includes(event.key)) return;
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea") || target.isContentEditable) return;
      event.preventDefault(); removeSelected();
    }}>
    <h2 id="detection-editor-title">{t("editDetection")}</h2><p className="detection-editor-help">{t("editDetectionHelp")}</p>
    <fieldset className="detection-editor-toolbar" disabled={busy}>
      <label><span>{t("detectedArea")}</span><select value={selected} disabled={!regions.length} onChange={(event) => setSelected(Number(event.target.value))}>
        {regions.map((_, index) => <option key={index} value={index}>{t("detectedArea")} {index + 1}</option>)}
      </select></label>
      <button type="button" className="action-button secondary" onClick={() => { const x = width * .3, y = height * .3, right = width * .7, bottom = height * .7; setRegions([...regions, { originalIndex: null, corners: [{ x, y }, { x: right, y }, { x: right, y: bottom }, { x, y: bottom }] }]); setSelected(regions.length); }}>{t("addArea")}</button>
      <button type="button" className="action-button secondary" disabled={selected < 0} onClick={removeSelected}>{t("removeArea")}</button>
      <span className="detection-editor-zoom">
        <button type="button" className="action-button secondary" onClick={() => changeZoom(-.25)}>{t("zoomOut")}</button>
        <button type="button" className="action-button secondary" onClick={() => setZoom(1)}>{t("resetZoom")}</button>
        <button type="button" className="action-button secondary" onClick={() => changeZoom(.25)}>{t("zoomIn")}</button>
      </span>
    </fieldset>
    <div ref={viewport} className="detection-editor-viewport" onWheel={(event) => { if (!event.ctrlKey && !event.metaKey) return; event.preventDefault(); changeZoom(event.deltaY < 0 ? .25 : -.25); }}>
      <div className="detection-editor-stage"><img src={sprite.image.src} alt="" draggable={false} style={{ width: baseWidth * zoom }} />
        <svg ref={svg} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${width} ${height}`} aria-label={t("editDetection")}
          onPointerMove={(event) => {
            if (!dragging.current || event.pointerId !== dragging.current.pointerId || busy) return;
            const matrix = svg.current?.getScreenCTM(); if (!matrix) return;
            moveCorner(dragging.current.corner, new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()));
          }} onPointerUp={() => { dragging.current = null; }} onPointerCancel={() => { dragging.current = null; }} onLostPointerCapture={() => { dragging.current = null; }}>
          {regions.map(({ corners }, index) => <g key={index}>
            <polygon points={corners.map(({ x, y }) => `${x},${y}`).join(" ")} className={index === selected ? "is-selected" : ""} onPointerDown={(event) => { if (!busy && event.button === 0) setSelected(index); }} />
            <text x={corners[0].x + 12 * scale} y={corners[0].y + 24 * scale} fontSize={16 * scale}>{index + 1}</text>
          </g>)}
          {selected >= 0 && regions[selected]?.corners.map(({ x, y }, corner) => <circle key={corner} cx={x} cy={y} r={8 * scale} tabIndex={0} role="button"
            aria-label={t("areaCorner").replace("{area}", String(selected + 1)).replace("{corner}", String(corner + 1))}
            onPointerDown={(event) => { if (busy || event.button !== 0) return; dragging.current = { corner, pointerId: event.pointerId }; svg.current?.setPointerCapture(event.pointerId); event.preventDefault(); }}
            onKeyDown={(event) => {
              const offsets: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
              const offset = offsets[event.key]; if (busy || !offset) return;
              event.preventDefault(); moveCorner(corner, { x: x + offset[0] * (event.shiftKey ? 10 : 1), y: y + offset[1] * (event.shiftKey ? 10 : 1) });
            }} />)}
        </svg>
      </div>
    </div>
    <p className="detection-editor-error" role="alert">{error}</p>
    <div className="detection-editor-actions"><button type="button" className="action-button secondary" disabled={busy} onClick={close}>{t("cancelDetectionEdits")}</button>
      <button type="button" className="action-button" disabled={busy} onClick={async () => { setBusy(true); setError(""); try { await onSave(regions); dialog.current?.close(); onClose(); } catch (cause) { console.error("Unable to save detection areas", cause); setError(t("saveDetectionError")); } finally { setBusy(false); } }}>{busy ? t("processing") : t("saveDetectionEdits")}</button>
    </div>
  </dialog>;
}
