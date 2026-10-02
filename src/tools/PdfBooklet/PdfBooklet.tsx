import { useEffect, useRef, useState, type DragEvent } from "react";
import { appStore } from "../../app-core.ts";
import { withLoading } from "../loading-overlay.tsx";
import { downloadPdf, joinPagesSideBySide, splitPagesInHalf } from "./operations.ts";
import { useLocalization } from "../../LocalizationProvider";

const STORE_KEY = "pdf-booklet";

export default function PdfBooklet() {
  const { t } = useLocalization();
  const input = useRef<HTMLInputElement>(null);
  const changedByUser = useRef(false);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState("uploadPreview");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    let active = true;
    appStore.get<{ file?: File }>(STORE_KEY).then((saved) => {
      if (active && !changedByUser.current && saved?.file) {
        setFile(saved.file);
        setStatus("chooseTransform");
      }
    }).catch((error) => console.warn("Unable to restore PDF", error));
    return () => { active = false; };
  }, []);

  function chooseFile(nextFile?: File) {
    if (!nextFile || (nextFile.type !== "application/pdf" && !/\.pdf$/i.test(nextFile.name))) return;
    changedByUser.current = true;
    setFile(nextFile);
    setStatus("chooseTransform");
    appStore.set(STORE_KEY, { file: nextFile }).catch((error) => console.warn("Unable to save PDF", error));
  }

  async function process(operation: (file: File) => Promise<Uint8Array>, suffix: string) {
    if (!file || busy) return;
    setBusy(true);
    setStatus("preparing");
    try {
      const bytes = await withLoading(() => operation(file));
      downloadPdf(bytes, `${file.name.replace(/\.pdf$/i, "")}-${suffix}.pdf`);
      setStatus("downloaded");
    } catch (error) {
      console.error(error);
      setStatus("pdfError");
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (!window.confirm(t("resetConfirm"))) return;
    changedByUser.current = true;
    await appStore.set(STORE_KEY, null);
    setFile(null);
    setStatus("uploadPreview");
    if (input.current) input.current.value = "";
  }

  return <section className="tool-page pdf-booklet-page">
    <p className="eyebrow">{t("bookletEyebrow")}</p>
    <h1>{t("pdfBooklet")}</h1>
    <p className="lede">{t("bookletLede")}</p>
    <div className="panel">
      <div className={`drop-zone${dragging ? " dragging" : ""}`}
        onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => { event.preventDefault(); setDragging(false); }}
        onDrop={(event) => { event.preventDefault(); setDragging(false); chooseFile(event.dataTransfer.files[0]); }}>
        <div>
          <div className="upload-icon">↥</div>
          <h2>{t("dropPdf")}</h2>
          <p>{t("orChoose")}</p>
          <button className="browse-button" type="button" onClick={() => input.current?.click()}>{t("choosePdf")}</button>
          <p className="file-note">{file?.name || t("pdfNote")}</p>
          <input ref={input} type="file" accept="application/pdf,.pdf" hidden
            onChange={(event) => chooseFile(event.target.files?.[0])} />
        </div>
      </div>
      <div className="options">
        <div className="option"><span>{t("paper")}</span><strong>A4</strong></div>
        <div className="option"><span>{t("layout")}</span><strong>{t("twoPages")}</strong></div>
        <div className="option"><span>{t("binding")}</span><strong>{t("shortEdge")}</strong></div>
      </div>
      {file && <div className="pdf-actions">
        <button className="action-button" type="button" disabled={busy}
          onClick={() => process(splitPagesInHalf, t("splitFilenameSuffix"))}>{t("split")}</button>
        <button className="action-button secondary" type="button" disabled={busy}
          onClick={() => process(joinPagesSideBySide, t("joinFilenameSuffix"))}>{t("join")}</button>
        <button className="reset-button" type="button" disabled={busy} onClick={reset}>{t("reset")}</button>
      </div>}
      <div className="empty-preview" role="status">{t(status)}</div>
    </div>
  </section>;
}
