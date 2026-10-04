import { useEffect, useRef, useState } from "react";
import { CardFrontsArea } from "./CardFrontsArea/CardFrontsArea.tsx";
import { CardBacksArea } from "./CardBacksArea/CardBacksArea.tsx";
import { PrintSettingsArea } from "./PrintSettingsArea/PrintSettingsArea.tsx";
import { CardsArea } from "./CardsArea/CardsArea.tsx";
import { useCardPrinter } from "./logic/useCardPrinter.ts";
import { IMAGE_ACCEPT } from "./logic/model.ts";
import { lockPageScroll } from "../scroll-lock.ts";
import { useLocalization } from "../../LocalizationProvider";

export default function CardPrinter() {
  const { t } = useLocalization();
  const controller = useCardPrinter(t);
  const fileInput = useRef<HTMLInputElement>(null);
  const lightboxClose = useRef<HTMLButtonElement>(null);
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    if (!controller.lightbox) return;
    const unlock = lockPageScroll();
    lightboxClose.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") controller.setLightbox(null); };
    document.addEventListener("keydown", onKeyDown);
    return () => { unlock(); document.removeEventListener("keydown", onKeyDown); };
  }, [controller.lightbox]);
  const dropZone = <div className={`drop-zone${dragging ? " dragging" : ""}`} onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
    onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { event.preventDefault(); setDragging(false); }}
    onDrop={(event) => { event.preventDefault(); setDragging(false); void controller.addSprites(event.dataTransfer.files); }}>
    <div>
      <div className="sprite-grid">{Array.from({ length: 24 }, (_, index) => <i className="sprite-cell" key={index} />)}</div>
      <h2>{t("dropSprites")}</h2><p>{t("imageTypes")}</p>
      <button className="browse-button" type="button" onClick={() => fileInput.current?.click()}>{t("addSprites")}</button>
      <p className="file-note">{controller.state.sprites.length ? t(controller.state.sprites.length === 1 ? "spriteLoaded" : "spritesLoaded", { count: controller.state.sprites.length }) : t("selectImages")}</p>
      <input ref={fileInput} className="file-picker-input" id="sprite-file-input" type="file" accept={IMAGE_ACCEPT} multiple
        onChange={(event) => { if (event.target.files) void controller.addSprites(event.target.files); event.target.value = ""; }} />
    </div>
  </div>;
  return <section className="tool-page sprites-page">
    <div className={`panel sprites-panel${controller.state.sprites.length ? " has-sprites" : ""}`}>
      <div data-workspace="" data-view={controller.state.view}>
        <div className="workspace-columns">
          <div className="workflow-column">
            <div className="workspace-header-row">
              <p className="eyebrow">{t("spritesEyebrow")}</p>
              <label className="workspace-view-selector">{t("view")}
                <select value={controller.state.view} onChange={(event) => controller.mutate((s) => { s.view = event.target.value as typeof s.view; })}>
                  <option value="two-columns">{t("twoColumns")}</option>
                  <option value="single-column">{t("singleColumn")}</option>
                </select>
              </label>
            </div>
            <h1>{t("toolTitle")}</h1>
            <p className="lede">{t("spritesLede")}</p>
            <aside className="how-it-works" aria-label={t("howItWorks")}>
              <h2>{t("howItWorks")}</h2><p>{t("howItWorksText")}</p>
            </aside>
            {controller.state.sprites.length === 0 && dropZone}
            {controller.state.sprites.length > 0 && <div>
              <CardFrontsArea controller={controller} dropZone={dropZone} />
              <CardBacksArea controller={controller} />
              <PrintSettingsArea controller={controller} />
            </div>}
          </div>
          {controller.state.sprites.length > 0 && <div className="workflow-column"><CardsArea controller={controller} /></div>}
        </div>
      </div>
    </div>
    {controller.lightbox && <div className="image-lightbox" onClick={(event) => { if (event.target === event.currentTarget) controller.setLightbox(null); }}>
      <button ref={lightboxClose} className="image-lightbox-close" type="button" aria-label={t("closePreview")} onClick={() => controller.setLightbox(null)}>×</button>
      <img src={controller.lightbox.src} alt={controller.lightbox.alt} />
    </div>}
  </section>;
}
