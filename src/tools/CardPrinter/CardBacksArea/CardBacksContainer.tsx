import { useRef, useState, type ReactNode } from "react";
import { IMAGE_ACCEPT } from "../logic/model.ts";
import type { Translator } from "../../../localization.ts";

export function CardBacksContainer({ items, t, onFiles }: { items: ReactNode[]; t: Translator; onFiles: (files: FileList) => void }) {
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
      {items.length ? items : <p className="back-empty">{t("noBacks")}</p>}
    </div>
  </>;
}
