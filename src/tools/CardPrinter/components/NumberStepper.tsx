import { useEffect, useRef, useState } from "react";
import { useLocalization } from "../../../LocalizationProvider.tsx";

export function NumberStepper({ value, min = 1, max, disabled, onChange }: { value: number; min?: number; max?: number; disabled?: boolean; onChange: (value: number) => void }) {
  const { t } = useLocalization();
  const input = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const next = Math.max(min, Math.min(max ?? Infinity, Number(input.current?.value) || min));
    setDraft(String(next)); if (next !== value) onChange(next);
  };
  return <span className="number-stepper">
    <input ref={input} type="number" min={min} max={max} disabled={disabled} value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} />
    <button className="number-stepper-button number-stepper-up" type="button" disabled={disabled} aria-label={t("increaseValue")} onMouseDown={(event) => event.preventDefault()} onClick={() => { input.current?.stepUp(); commit(); }}>⌃</button>
    <button className="number-stepper-button number-stepper-down" type="button" disabled={disabled} aria-label={t("decreaseValue")} onMouseDown={(event) => event.preventDefault()} onClick={() => { input.current?.stepDown(); commit(); }}>⌄</button>
  </span>;
}
