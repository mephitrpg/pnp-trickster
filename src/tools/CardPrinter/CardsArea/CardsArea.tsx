import { useLocalization } from "../../../LocalizationProvider";
import { useRef, useState } from "react";
import { CardPreviewMarkup } from "../utils/CardPreviewMarkup.tsx";
import { LoadingCardMarkup } from "../utils/LoadingCardMarkup.tsx";
import type { CardPrinterController } from "../logic/useCardPrinter.ts";

export function CardsArea({ controller }: { controller: CardPrinterController }) {
  const { t } = useLocalization();
  const drag = useRef<{ ids: string[]; target: string | null } | null>(null);
  const [dragIds, setDragIds] = useState<string[]>([]);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const open = (src: string, alt: string) => controller.setLightbox({ src, alt });
  const scrollGrid = (id: string) => {
    const element = document.querySelector<HTMLElement>(`[data-sprite-editor="${id}"]`);
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
    element?.classList.add("sprite-editor-highlight");
    window.setTimeout(() => element?.classList.remove("sprite-editor-highlight"), 1400);
  };
  const dragMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!drag.current) return;
    const target = (document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-card-selectable]") as HTMLElement | null)?.dataset.cardSelectable;
    const id = target && !drag.current.ids.includes(target) ? target : null;
    drag.current.target = id; setDropTarget(id);
    const edge = 96;
    if (event.clientY < edge) window.scrollBy({ top: -Math.ceil((edge - event.clientY) / 7), behavior: "auto" });
    else if (window.innerHeight - event.clientY < edge) window.scrollBy({ top: Math.ceil((edge - (window.innerHeight - event.clientY)) / 7), behavior: "auto" });
  };
  const finishDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!drag.current) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (drag.current.target) controller.reorderCards(drag.current.ids, drag.current.target);
    drag.current = null; setDragIds([]); setDropTarget(null);
  };
  return <section className="sprite-workflow-area" aria-label={t("cards")}>
    <div className="sprite-section-title cards-section-title"><div><h2>{t("cards")}</h2><p>{t("cardsHelp")}</p></div>
      <div className="cards-section-actions">
        <label className="printable-filter"><input type="checkbox" checked={controller.state.hideNotPrintable} onChange={(event) => controller.mutate((s) => { s.hideNotPrintable = event.target.checked; })} /> <span>{t(`${controller.state.hideNotPrintable ? "hide" : "show"}${controller.unprintable === 1 ? "UnprintableCard" : "UnprintableCards"}`, { count: controller.unprintable })}</span></label>
        <button className="action-button secondary select-all-cards" type="button" disabled={!controller.selectable.length} aria-pressed={controller.allSelected} onClick={controller.selectAllCards}>{t(controller.allSelected ? "deselectAllCards" : "selectAllCards")}</button>
      </div>
    </div>
    <div className="cards-preview">{controller.entries.map(({ sprite, index, id }) => {
      if (sprite.isGridLoading || !sprite.cards[index]) {
        const progress = Number.isFinite(sprite.gridProgress) ? sprite.gridProgress! : null;
        return (!controller.state.hideNotPrintable || sprite.backIndex !== index) && <LoadingCardMarkup key={id} isBack={sprite.backIndex === index} label={progress === null ? t("processing") : t("detecting").replace("{percent}", String(progress))} progress={progress} />;
      }
      const card = sprite.cards[index];
      if (controller.state.hideNotPrintable && (!card.selected || card.isBack)) return null;
      const selectedBack = controller.state.backs.find((back) => back.id === card.backId);
      const frontUrl = controller.preview.tile(sprite, index);
      const backUrl = controller.preview.back(controller.state, selectedBack);
      return <CardPreviewMarkup key={id} sprite={sprite} index={index} id={id} card={card} backs={controller.state.backs}
        selectedBack={selectedBack} frontUrl={frontUrl} backUrl={backUrl} spriteName={controller.spriteName(sprite)} t={t} backDisplayName={controller.backName}
        onSelect={(event) => controller.selectCard(id, event)} onPrint={() => controller.mutate(() => { card.selected = !card.selected; })}
        onIsBack={(value) => void controller.updateAutomaticBack(sprite.id, value === "back" ? index : null)}
        onBack={(value) => controller.setCardBack(id, value || null)} onOpenImage={open} onScrollGrid={() => scrollGrid(sprite.id)}
        onDragStart={(event) => { if (event.button !== 0 || !card.backSelected || card.isBack) return; event.preventDefault(); const ids = controller.selectedTargets.some((entry) => entry.id === id) ? controller.selectedTargets.map((entry) => entry.id) : [id]; drag.current = { ids, target: null }; setDragIds(ids); event.currentTarget.setPointerCapture(event.pointerId); }}
        onDragMove={dragMove} onDragEnd={finishDrag} dragging={dragIds.includes(id)} dropTarget={dropTarget === id} />;
    })}</div>
  </section>;
}
