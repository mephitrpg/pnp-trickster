import { useLocalization } from "../../../LocalizationProvider";
import type { CardPrinterController } from "../logic/useCardPrinter.ts";
import { CardBack } from "./CardBack.tsx";
import { CardBacksContainer } from "./CardBacksContainer.tsx";

export function CardBacksArea({ controller }: { controller: CardPrinterController }) {
  const { t } = useLocalization();
  const scrollGrid = (id: string) => {
    const element = document.querySelector<HTMLElement>(`[data-sprite-editor="${id}"]`);
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
    element?.classList.add("sprite-editor-highlight");
    window.setTimeout(() => element?.classList.remove("sprite-editor-highlight"), 1400);
  };
  const items = controller.state.backs.map((back) => <CardBack key={back.id} back={back} controller={controller}
    t={t} canApply={controller.selectedTargets.length > 0} onScrollGrid={scrollGrid} />);

  return <section className="sprite-workflow-area" aria-label={t("cardBacks")}>
    <div className="sprite-section-title"><div><h2>{t("cardBacks")}</h2><p>{t("cardBacksHelp")}</p></div></div>
    <div className="backs-setup"><CardBacksContainer items={items} t={t} onFiles={(files) => void controller.addBacks(files)} /></div>
  </section>;
}
