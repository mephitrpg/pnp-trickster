import { PAGE_FORMATS } from "../logic/model.ts";
import { useLocalization } from "../../../LocalizationProvider";
import { NumberStepper } from "../components/NumberStepper.tsx";
import type { CardPrinterController } from "../logic/useCardPrinter.ts";

export function PrintSettingsArea({ controller }: { controller: CardPrinterController }) {
  const { t } = useLocalization();
  const { state } = controller;
  return <section className="sprite-workflow-area" aria-label={t("printSettings")}>
    <div className="sprite-section-title"><div><h2>{t("printSettings")}</h2><p>{t("printSettingsHelp")}</p></div></div>
    <div className="print-toolbar">
      <label>{t("print")}<select value={state.mode} onChange={(event) => controller.mutate((s) => { s.mode = event.target.value as typeof s.mode; })}>
        <option value="front">{t("frontOnly")}</option><option value="back">{t("backOnly")}</option>
        <option value="both">{t("bothSides")}</option>
      </select></label>
      <label>{t("pageFormat")}<select value={state.pageFormat} onChange={(event) => controller.mutate((s) => { s.pageFormat = event.target.value; })}>
        {PAGE_FORMATS.map((format: string) => <option value={format} key={format}>{format}</option>)}
      </select></label>
      <label>{t("orientation")}<select value={state.orientation} onChange={(event) => controller.mutate((s) => { s.orientation = event.target.value as typeof s.orientation; })}>
        <option value="portrait">{t("portrait")}</option><option value="landscape">{t("landscape")}</option>
      </select></label>
      <label>{t("cardWidth")}<span className="dimension-input"><NumberStepper value={state.width} min={10} onChange={(value) => controller.mutate((s) => { s.width = Math.max(10, value || 63); })} /><span>mm</span></span></label>
      <label>{t("cardHeight")}<span className="dimension-input"><NumberStepper value={state.height} min={10} onChange={(value) => controller.mutate((s) => { s.height = Math.max(10, value || 88); })} /><span>mm</span></span></label>
      <strong>{controller.selected.length} / {controller.entries.length} {t(controller.selected.length === 1 ? "selectedCard" : "selectedCards")} · {controller.selected.filter(({ sprite, index }) => sprite.cards[index].backId).length} {t("withBack")}</strong>
      <button className="action-button" type="button" disabled={controller.busy || !controller.selected.length} onClick={() => void controller.download()}>{t("previewPdf")}</button>
      <button className="action-button secondary" type="button" onClick={() => void controller.reset()}>{t("reset")}</button>
    </div>
  </section>;
}
