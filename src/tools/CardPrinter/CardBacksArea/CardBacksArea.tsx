import { useLocalization } from "../../../LocalizationProvider";
import { BacksMarkup } from "../utils/BacksMarkup.tsx";
import type { CardPrinterController } from "../logic/useCardPrinter.ts";

export function CardBacksArea({ controller }: { controller: CardPrinterController }) {
  const { t } = useLocalization();
  const items = controller.state.backs.map((back) => {
    const spriteIndex = controller.state.sprites.findIndex((sprite) => sprite.id === back.spriteId);
    const sprite = controller.state.sprites[spriteIndex];
    const fileName = back.kind === "file" ? back.fileName || back.name : sprite?.fileName || sprite?.name;
    return { back, spriteNumber: sprite?.gridNumber || spriteIndex + 1, fileName,
      imageUrl: controller.preview.back(controller.state, back),
      placeholder: t("backPlaceholder").replace("{number}", String(back.backNumber)), displayName: controller.backName(back) };
  });
  const scrollGrid = (id: string) => {
    const element = document.querySelector<HTMLElement>(`[data-sprite-editor="${id}"]`);
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
    element?.classList.add("sprite-editor-highlight");
    window.setTimeout(() => element?.classList.remove("sprite-editor-highlight"), 1400);
  };
  return <section className="sprite-workflow-area" aria-label={t("cardBacks")}>
    <div className="sprite-section-title"><div><h2>{t("cardBacks")}</h2><p>{t("cardBacksHelp")}</p></div></div>
    <div className="backs-setup"><BacksMarkup items={items} t={t} canApply={controller.selectedTargets.length > 0}
      onFiles={(files) => void controller.addBacks(files)} onRemove={controller.removeBack}
      onName={(id, name) => controller.mutate((state) => { const back = state.backs.find((entry) => entry.id === id); if (back) { back.name = name; back.customName = Boolean(name); } })}
      onApply={controller.applyBack} onScrollGrid={scrollGrid} onOpenImage={(src, alt) => controller.setLightbox({ src, alt })} /></div>
  </section>;
}
