import { useState } from "react";
import RemoveIcon from "../utils/RemoveIcon.tsx";
import type { Translator } from "../../../localization.ts";
import type { CardPrinterController } from "../logic/useCardPrinter.ts";

export function CardBack({ back, controller, t, canApply, onScrollGrid }: {
  back: CardPrinterController["state"]["backs"][number];
  controller: CardPrinterController;
  t: Translator;
  canApply: boolean;
  onScrollGrid: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const spriteIndex = controller.state.sprites.findIndex((sprite) => sprite.id === back.spriteId);
  const sprite = controller.state.sprites[spriteIndex];
  const fileName = back.kind === "file" ? back.fileName || back.name : sprite?.fileName || sprite?.name;
  const imageUrl = controller.preview.back(controller.state, back);
  const placeholder = t("backPlaceholder").replace("{number}", String(back.backNumber));
  const displayName = controller.backName(back);

  return <article className="back-item" key={back.id}>
    <div className="back-selection-bar"><span className="back-select-label">{placeholder}</span>
      <button className="back-remove-button" type="button" aria-label={`${t("removeBack")}: ${displayName}`} onClick={() => controller.removeBack(back.id)}><RemoveIcon /></button>
    </div>
    <div className="back-thumbnail"><img src={imageUrl} alt={displayName} loading="lazy" onClick={() => controller.setLightbox({ src: imageUrl, alt: displayName })} /></div>
    <div className="back-details">
      <label>{t("backName")}
        <input defaultValue={back.name || ""} placeholder={placeholder} onBlur={(event) => controller.mutate((state) => { const current = state.backs.find((entry) => entry.id === back.id); if (current) { current.name = event.target.value.trim(); current.customName = Boolean(current.name); } })} />
        {back.kind === "sprite-grid-card" ? <small className="last-card-badge">{t("auto")}</small>
          : back.kind === "file" ? <small className="last-card-badge">{t("image")}</small> : null}
        {back.spriteId && <button className="back-grid-link" type="button" onClick={() => onScrollGrid(back.spriteId!)}>{t("sprite")} {sprite?.gridNumber || spriteIndex + 1}</button>}
      </label>
      <button className="action-button secondary apply-back" type="button" disabled={!canApply} onClick={() => controller.applyBack(back.id)}>{t("applyToSelectedCards")}</button>
      {fileName && <small className={`back-file-info${expanded ? " has-expanded-file" : ""}`}><span className="sprite-file-name" title={fileName} onClick={() => setExpanded((value) => !value)}>{t("file")}: {fileName}</span></small>}
    </div>
  </article>;
}
