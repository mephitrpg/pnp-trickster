import type { Translator } from "../../../localization";
import type { CardScale } from "../logic/model.ts";

function CardFaceImage({ src, alt, scale, onOpenImage }: { src: string; alt: string; scale: CardScale; onOpenImage: (src: string, alt: string) => void }) {
  return <div className="card-face-image" data-scale={scale}>
    <img src={src} alt={alt} loading="lazy" onClick={(event) => onOpenImage(event.currentTarget.src, event.currentTarget.alt)} />
  </div>;
}

export function CardPreviewMarkup({ sprite, index, id, card, backs, selectedBack, frontUrl, backUrl, frontScale, backScale, spriteName, t, backDisplayName, onSelect, onPrint, onIsBack, onBack, onFrontScale, onBackScale, onOpenImage, onScrollGrid, onDragStart, onDragMove, onDragEnd, dragging, dropTarget }: {
  sprite: { id: string }; index: number; id: string;
  card: { selected: boolean; isBack: boolean; backSelected: boolean; backId?: string | null };
  backs: Array<{ id: string }>; selectedBack?: { id: string }; frontUrl: string; backUrl: string; frontScale: CardScale; backScale: CardScale; spriteName: string;
  t: Translator; backDisplayName: (back: { id: string }) => string;
  onSelect: (event: React.MouseEvent | React.PointerEvent) => void; onPrint: () => void;
  onIsBack: (value: string) => void; onBack: (value: string) => void;
  onFrontScale: (value: CardScale) => void; onBackScale: (value: CardScale) => void;
  onOpenImage: (src: string, alt: string) => void; onScrollGrid: () => void;
  onDragStart: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onDragMove: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onDragEnd: (event: React.PointerEvent<HTMLButtonElement>) => void;
  dragging?: boolean; dropTarget?: boolean;
}) {
  const selectable = card.backSelected && !card.isBack;
  const printable = card.selected && !card.isBack;
  return <article className={`card-preview ${printable ? "" : "is-off"}${card.isBack ? " is-back" : ""} ${selectable ? "is-selected" : ""}${dragging ? " is-dragging" : ""}${dropTarget ? " is-drop-target" : ""}`} data-card-selectable={id}
    onPointerDown={(event) => { if (event.button !== 0 || (event.target as Element).closest("button, select, input, label, img")) return; event.preventDefault(); onSelect(event); }}>
    <div className="card-preview-actions"><div className="card-selection-bar">
      <button className="card-selection-button" type="button" aria-pressed={selectable} disabled={card.isBack} onPointerDown={(event) => { if (event.button === 0) { event.preventDefault(); onSelect(event); } }} onClick={(event) => { if (event.detail === 0) onSelect(event); }}>{t("selectCard")}</button>
      <button className="card-drag-handle" type="button" aria-label={t("dragCards")} title={t("dragCards")} hidden={!selectable} onPointerDown={onDragStart} onPointerMove={onDragMove} onPointerUp={onDragEnd}>⠿</button>
    </div></div>
    <div className="card-flags">
      <strong className="sprite-card-label"><button className="back-grid-link sprite-card-link" type="button" title={spriteName} onClick={onScrollGrid}>{spriteName}</button><span>, {t("card")} {index + 1}</span></strong>
      <label className="card-check" title={card.isBack ? t("printDisabledBack") : undefined}>
        <input type="checkbox" checked={card.selected} disabled={card.isBack} onChange={onPrint} /> {t("print")}
      </label>
    </div>
    <div className="card-faces">
      <figure><CardFaceImage src={frontUrl} alt={`${t("front")} ${t("card")} ${index + 1}`} scale={frontScale} onOpenImage={onOpenImage} />
        <select className="card-is-back" aria-label={`${t("front")} / ${t("back")}`} disabled={selectable} value={card.isBack ? "back" : "front"} onChange={(event) => onIsBack(event.target.value)}>
          <option value="front">{t("front")}</option><option value="back">{t("back")}</option>
        </select>
        <select className="card-scale-select" aria-label={`${t("front")} ${t("scale")}`} value={frontScale} disabled={!printable} onChange={(event) => onFrontScale(event.target.value as CardScale)}>
          <option value="stretch">Stretch</option><option value="cover">Cover</option><option value="contain">Contain</option>
        </select>
      </figure>
      <figure>
        {backUrl ? <CardFaceImage src={backUrl} alt={`${t("back")} ${selectedBack ? backDisplayName(selectedBack) : ""}`} scale={backScale} onOpenImage={onOpenImage} /> : <div className="missing-back">{t("noBack")}</div>}
        <select className="card-back-select" aria-label={t("back")} disabled={card.isBack} value={card.backId || ""} onChange={(event) => onBack(event.target.value)}>
          <option value="">{t("noBack")}</option>
          {backs.map((back) => <option value={back.id} key={back.id}>{backDisplayName(back)}</option>)}
        </select>
        <select className="card-scale-select" aria-label={`${t("back")} ${t("scale")}`} value={backScale} disabled={!backUrl || !printable} onChange={(event) => onBackScale(event.target.value as CardScale)}>
          <option value="stretch">Stretch</option><option value="cover">Cover</option><option value="contain">Contain</option>
        </select>
      </figure>
    </div>
  </article>;
}
