import { useLocalization } from "../../../LocalizationProvider";
import { useRef, useState } from "react";
import { CardAreaItem } from "./CardsAreaItem.tsx";
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
    <div className="sprite-section-title cards-section-title"><div><h2>{t("cards")}</h2><p>{t("cardsHelp")}</p><p><strong>{t("cardsHelpSelection")}</strong></p><p>{t("cardsHelpOrder")}</p></div>
      <div className="cards-section-actions">
        <label className="printable-filter"><input type="checkbox" checked={controller.state.hideNotPrintable} onChange={(event) => controller.mutate((s) => { s.hideNotPrintable = event.target.checked; })} /> <span>{t(controller.unprintable === 1 ? "hideUnprintableCard" : "hideUnprintableCards", { count: controller.unprintable })}</span></label>
        <button className="action-button secondary select-all-cards" type="button" disabled={!controller.selectable.length} aria-pressed={controller.allSelected} onClick={controller.selectAllCards}>{t(controller.allSelected ? "deselectAllCards" : "selectAllCards")}</button>
      </div>
    </div>
    <div className="cards-preview" style={{ "--card-aspect-ratio": `${controller.state.width} / ${controller.state.height}` } as React.CSSProperties}>{controller.entries.map(({ sprite, index, id }) => <CardAreaItem key={id} controller={controller} sprite={sprite} index={index} id={id}
      onOpenImage={open} onScrollGrid={scrollGrid} dragging={dragIds.includes(id)} dropTarget={dropTarget === id} onDragMove={dragMove} onDragEnd={finishDrag}
      onDragStart={(event, cardId, card) => { if (event.button !== 0 || !card.backSelected || card.isBack) return; event.preventDefault(); const ids = controller.selectedTargets.some((entry) => entry.id === cardId) ? controller.selectedTargets.map((entry) => entry.id) : [cardId]; drag.current = { ids, target: null }; setDragIds(ids); event.currentTarget.setPointerCapture(event.pointerId); }} />)}</div>
  </section>;
}
