import RemoveIcon from "./RemoveIcon.tsx";
import { useRef, useState } from "react";
import { IMAGE_ACCEPT } from "../logic/model.ts";
import type { Translator } from "../../../localization";

export function BacksMarkup({ items, t, onFiles, onRemove, onName, onApply, onScrollGrid, onOpenImage, canApply }: { items: Array<{
  back: { id: string; name: string; kind: string; spriteId?: string };
  spriteNumber: number; fileName?: string; imageUrl: string; placeholder: string; displayName: string;
}>; t: Translator; onFiles: (files: FileList) => void; onRemove: (id: string) => void;
  onName: (id: string, name: string) => void; onApply: (id: string) => void;
  onScrollGrid: (id: string) => void; onOpenImage: (src: string, alt: string) => void;
  canApply: boolean;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  return <>
    <div className={`back-file-add back-drop-zone${dragging ? " dragging" : ""}`}
      onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => { event.preventDefault(); setDragging(false); }}
      onDrop={(event) => { event.preventDefault(); setDragging(false); onFiles(event.dataTransfer.files); }}>
      <h3>{t("separateFileBack")}</h3><p>{t("backDropHint")}</p>
      <button className="browse-button" type="button" onClick={() => fileInput.current?.click()}>{t("addFile")}</button>
      <input ref={fileInput} className="file-picker-input" type="file" accept={IMAGE_ACCEPT} multiple onChange={(event) => { if (event.target.files) onFiles(event.target.files); event.target.value = ""; }} />
    </div>
    <div className="back-list" role="radiogroup">
      {items.length ? items.map(({ back, spriteNumber, fileName, imageUrl, placeholder, displayName }) => <article className="back-item" key={back.id}>
        <div className="back-selection-bar"><span className="back-select-label">{placeholder}</span>
          <button className="back-remove-button" type="button" aria-label={`${t("removeBack")}: ${displayName}`} onClick={() => onRemove(back.id)}><RemoveIcon /></button>
        </div>
        <div className="back-thumbnail"><img src={imageUrl} alt={displayName} loading="lazy" onClick={() => onOpenImage(imageUrl, displayName)} /></div>
        <div className="back-details">
          <label>{t("backName")}
            <input defaultValue={back.name || ""} placeholder={placeholder} onBlur={(event) => onName(back.id, event.target.value.trim())} />
            {back.kind === "sprite-grid-card" ? <small className="last-card-badge">{t("auto")}</small>
              : back.kind === "file" ? <small className="last-card-badge">{t("image")}</small> : null}
            {back.spriteId && <button className="back-grid-link" type="button" onClick={() => onScrollGrid(back.spriteId!)}>{t("sprite")} {spriteNumber}</button>}
          </label>
          <button className="action-button secondary apply-back" type="button" disabled={!canApply} onClick={() => onApply(back.id)}>{t("applyToSelectedCards")}</button>
          {fileName && <BackFileName fileName={fileName} t={t} />}
        </div>
      </article>) : <p className="back-empty">{t("noBacks")}</p>}
    </div>
  </>;
}
function BackFileName({ fileName, t }: { fileName: string; t: Translator }) {
  const [expanded, setExpanded] = useState(false);
  return <small className={`back-file-info${expanded ? " has-expanded-file" : ""}`}><span className="sprite-file-name" title={fileName} onClick={() => setExpanded((value) => !value)}>{t("file")}: {fileName}</span></small>;
}
