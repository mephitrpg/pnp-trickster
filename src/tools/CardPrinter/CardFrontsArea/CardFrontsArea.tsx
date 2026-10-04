import type { ReactNode } from "react";
import { useLocalization } from "../../../LocalizationProvider";
import { CardFront } from "./CardFront.tsx";
import { DetectionEditor } from "./DetectionEditor.tsx";
import type { CardPrinterController } from "../logic/useCardPrinter.ts";

export function CardFrontsArea({ controller, dropZone }: { controller: CardPrinterController; dropZone: ReactNode }) {
  const { t } = useLocalization();
  const editingSprite = controller.state.sprites.find((sprite) => sprite.id === controller.editingSpriteId);
  return <section className="sprite-workflow-area" aria-label={t("spriteGrids")}>
    <div className="sprite-section-title"><div><h2>{t("spriteGrids")}</h2><p>{t("spriteGridsHelp")}</p></div></div>
    {dropZone}
    <div className="sprite-editors">{controller.state.sprites.map((sprite) => <CardFront key={sprite.id} sprite={sprite} controller={controller} />)}</div>
    {editingSprite && <DetectionEditor key={editingSprite.id} sprite={editingSprite} onSave={(areas) => controller.saveDetectionAreas(editingSprite.id, areas)} onClose={() => controller.setEditingSpriteId(null)} />}
  </section>;
}
