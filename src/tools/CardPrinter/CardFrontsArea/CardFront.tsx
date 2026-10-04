import { useEffect, useRef, useState } from "react";
import { lockPageScroll } from "../../scroll-lock.ts";
import { useLocalization } from "../../../LocalizationProvider.tsx";
import RemoveIcon from "../utils/RemoveIcon.tsx";
import type { Sprite } from "../logic/model.ts";
import type { CardPrinterController } from "../logic/useCardPrinter.ts";
import { NumberStepper } from "../components/NumberStepper.tsx";

const ASSUMED_SCAN_DPIS = [72, 75, 100, 150, 200, 240, 300];
function SizeEstimateDialog({ sprite, onClose }: { sprite: Sprite; onClose: () => void }) {
  const { t } = useLocalization();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const node = dialog.current!; node.showModal(); const unlock = lockPageScroll(node); return () => { unlock(); node.close(); }; }, []);
  return <dialog ref={dialog} className="card-size-estimate-dialog" onClose={onClose}>
    <h2>{t("cardSizeEstimation")}</h2>
    <table><thead><tr><th>{t("dpi")}</th><th>{t("widthMm")}</th><th>{t("heightMm")}</th></tr></thead><tbody>
      {ASSUMED_SCAN_DPIS.map((dpi) => <tr key={dpi}><td>{dpi}</td><td>{(sprite.image.naturalWidth / sprite.columns / dpi * 25.4).toFixed(1)}</td><td>{(sprite.image.naturalHeight / sprite.rows / dpi * 25.4).toFixed(1)}</td></tr>)}
    </tbody></table><div><button type="button" className="action-button secondary" onClick={() => dialog.current?.close()}>{t("close")}</button></div>
  </dialog>;
}

export function CardFront({ sprite, controller }: { sprite: Sprite; controller: CardPrinterController }) {
  const { t } = useLocalization();
  const [estimateOpen, setEstimateOpen] = useState(false);
  const [confirmed, setConfirmed] = useState("");
  const [fileExpanded, setFileExpanded] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [name, setName] = useState(sprite.name);
  const fallbackName = t("spritePlaceholder").replace("{number}", String(sprite.gridNumber));
  const displayName = controller.spriteName(sprite);
  const total = sprite.columns * sprite.rows;
  const width = sprite.dpi ? sprite.image.naturalWidth / sprite.columns / sprite.dpi.x * 25.4 : 0;
  const height = sprite.dpi ? sprite.image.naturalHeight / sprite.rows / sprite.dpi.y * 25.4 : 0;
  const showEstimate = sprite.gridType !== "detect";
  const confirm = (key: string) => { setConfirmed(key); window.setTimeout(() => setConfirmed(""), 700); };
  const progress = sprite.gridProgress;
  useEffect(() => {
    if (!sprite.isGridLoading) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [sprite.isGridLoading]);
  const elapsed = now - (sprite.loadingStartedAt || now);
  const slow = elapsed >= 30000 ? t("detectStalled") : elapsed >= 10000 ? t("detectSlow") : "";
  return <article className={`sprite-editor${sprite.gridType === "detect" ? " sprite-editor-detect" : ""}`} data-sprite-editor={sprite.id}>
    <div className="sprite-editor-top-bar"><span>{t("spriteGrid")} {sprite.gridNumber}</span>
      <button type="button" className="remove-sprite" aria-label={`${t("removeSprite")}: ${displayName}`} onClick={() => controller.removeSprite(sprite.id)}><RemoveIcon /></button>
    </div>
    <div className="sprite-thumbnail"><img src={sprite.image.src} alt={displayName} loading="lazy" onClick={() => controller.setLightbox({ src: sprite.image.src, alt: displayName })} /></div>
    <div>
      <div className="sprite-editor-heading">
        <label>{t("spriteName")}<input value={name} placeholder={fallbackName} onChange={(event) => setName(event.target.value)} onBlur={() => { const value = name.trim(); setName(value); controller.mutate(() => { sprite.name = value; }); }} /></label>
        <label className="grid-type-field">{t("gridType")}
          <select value={sprite.gridType} disabled={sprite.isGridLoading} onChange={(event) => void controller.updateGridType(sprite.id, event.target.value as "sprite" | "detect")}>
            <option value="sprite">{t("sprite")}</option><option value="detect">{t("detect")}</option>
          </select>
        </label>
      </div>
      {sprite.gridType === "detect" && <div className="detect-controls">
        <button className="action-button secondary" type="button" onClick={() => sprite.detectRequestId ? void controller.cancelDetection(sprite.id) : void controller.detect(sprite.id)} disabled={Boolean(sprite.isGridLoading && !sprite.detectRequestId)}>{sprite.detectRequestId ? t("stopDetect") : t("startDetect")}</button>
        <button className="action-button secondary" type="button" disabled={sprite.isGridLoading} onClick={() => controller.setEditingSpriteId(sprite.id)}>{t("editDetectedAreas")}</button>
        <span className="detect-status" aria-live="polite">{progress !== undefined ? t("detecting").replace("{percent}", String(progress)) : t("detectIdle")}</span>
        <small className="detect-message">{slow}</small>
      </div>}
      <div className="grid-inputs">
        {sprite.gridType !== "detect" && <>
          <label>{t("horizontalCards")}<NumberStepper value={sprite.columns} max={12} disabled={sprite.isGridLoading} onChange={(value) => void controller.updateGrid(sprite.id, "columns", value)} /></label>
          <label>{t("verticalCards")}<NumberStepper value={sprite.rows} max={12} disabled={sprite.isGridLoading} onChange={(value) => void controller.updateGrid(sprite.id, "rows", value)} /></label>
        </>}
        {showEstimate && (sprite.dpi ? <small className="card-size-estimate"><span className="card-size-estimate-title">{t("cardSize")}</span><strong>{width.toFixed(1)} × {height.toFixed(1)} mm</strong><small>{Math.round((sprite.dpi.x + sprite.dpi.y) / 2)} {t("dpi")}</small></small>
          : <button className="action-button secondary show-card-size-estimate" type="button" onClick={() => setEstimateOpen(true)}>{t("viewCardSizeEstimation")}</button>)}
        <label>{t("automaticBack")}
          <select data-back-index aria-label={t("automaticBack")} disabled={sprite.isGridLoading} value={sprite.backIndex === null ? "" : String(sprite.backIndex)} onChange={(event) => void controller.updateAutomaticBack(sprite.id, event.target.value === "" ? null : Number(event.target.value))}>
            <option value="">{t("none")}</option>{Array.from({ length: total }, (_, index) => <option value={index} key={index}>{t("card")} {index + 1}</option>)}
          </select>
        </label>
      </div>
      <div className="grid-card-actions">
        <button className={`action-button secondary deselect-grid-cards${confirmed === "deselect" ? " is-confirmed" : ""}`} type="button" onClick={() => { controller.selectGrid(sprite.id, false); confirm("deselect"); }}>{t("deselectCards")}</button>
        <button className={`action-button secondary select-grid-cards${confirmed === "select" ? " is-confirmed" : ""}`} type="button" onClick={() => { controller.selectGrid(sprite.id, true); confirm("select"); }}>{t("selectCards")}</button>
        <button className={`action-button secondary apply-grid-back${confirmed === "apply" ? " is-confirmed" : ""}`} type="button" disabled={!controller.selectedTargets.length || !controller.state.backs.some((back) => back.kind === "sprite-grid-card" && back.spriteId === sprite.id)} onClick={() => { const back = controller.state.backs.find((entry) => entry.kind === "sprite-grid-card" && entry.spriteId === sprite.id); if (back) { controller.applyBack(back.id); confirm("apply"); } }}>{t("applyBackToSelectedCards")}</button>
      </div>
      <small className={fileExpanded ? "has-expanded-file" : ""}><span>{t(total === 1 ? "totalCard" : "totalCards", { count: total })}</span><span className="sprite-file-name" title={sprite.fileName} onClick={() => setFileExpanded((value) => !value)}>{t("file")}: {sprite.fileName}</span></small>
    </div>
    {estimateOpen && <SizeEstimateDialog sprite={sprite} onClose={() => setEstimateOpen(false)} />}
  </article>;
}
