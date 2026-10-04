import { useLocalization } from "../../../LocalizationProvider.tsx";
import { CardPreviewMarkup } from "../utils/CardPreviewMarkup.tsx";
import { LoadingCardMarkup } from "../utils/LoadingCardMarkup.tsx";
import type { CardPrinterController } from "../logic/useCardPrinter.ts";

type Props = {
  controller: CardPrinterController;
  sprite: CardPrinterController["entries"][number]["sprite"];
  index: number;
  id: string;
  dragging: boolean;
  dropTarget: boolean;
  onOpenImage: (src: string, alt: string) => void;
  onScrollGrid: (id: string) => void;
  onDragStart: (event: React.PointerEvent<HTMLButtonElement>, id: string, card: NonNullable<CardPrinterController["entries"][number]["sprite"]["cards"][number]>) => void;
  onDragMove: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onDragEnd: (event: React.PointerEvent<HTMLButtonElement>) => void;
};

export function CardAreaItem({ controller, sprite, index, id, dragging, dropTarget, onOpenImage, onScrollGrid, onDragStart, onDragMove, onDragEnd }: Props) {
  const { t } = useLocalization();
  const card = sprite.cards[index];
  if (sprite.isGridLoading || !card) {
    const progress = Number.isFinite(sprite.gridProgress) ? sprite.gridProgress! : null;
    return (!controller.state.hideNotPrintable || sprite.backIndex !== index) && <LoadingCardMarkup key={id} isBack={sprite.backIndex === index} label={progress === null ? t("processing") : t("detecting").replace("{percent}", String(progress))} progress={progress} />;
  }
  if (controller.state.hideNotPrintable && (!card.selected || card.isBack)) return null;
  const selectedBack = controller.state.backs.find((back) => back.id === card.backId);
  const frontUrl = controller.preview.tile(sprite, index);
  const backUrl = controller.preview.back(controller.state, selectedBack);
  return <CardPreviewMarkup key={id} sprite={sprite} index={index} id={id} card={card} backs={controller.state.backs}
    selectedBack={selectedBack} frontUrl={frontUrl} backUrl={backUrl} frontScale={card.frontScale} backScale={card.backScale} spriteName={controller.spriteName(sprite)} t={t} backDisplayName={controller.backName}
    onSelect={(event) => controller.selectCard(id, event)} onPrint={() => controller.mutate(() => { card.selected = !card.selected; })}
    onIsBack={(value) => void controller.updateAutomaticBack(sprite.id, value === "back" ? index : null)}
    onBack={(value) => controller.setCardBack(id, value || null)} onOpenImage={onOpenImage} onScrollGrid={() => onScrollGrid(sprite.id)}
    onFrontScale={(value) => controller.setCardScale(id, "front", value)}
    onBackScale={(value) => controller.setCardScale(id, "back", value)}
    onDragStart={(event) => onDragStart(event, id, card)} onDragMove={onDragMove} onDragEnd={onDragEnd} dragging={dragging} dropTarget={dropTarget} />;
}
