export function LoadingCardMarkup({ isBack, label, progress }: { isBack: boolean; label: string; progress: number | null }) {
  return <article className={`card-preview card-preview-loading${isBack ? " is-back" : ""}`} aria-busy="true">
    <div className="card-selection-bar" aria-hidden="true" />
    <div className="card-flags"><span /><span /></div>
    <div className="card-faces"><figure><div className="card-loading-face" /><span className="card-loading-control" /></figure><figure><div className="card-loading-face" /><span className="card-loading-control" /></figure></div>
    <div className="card-loading-indicator"><span className="card-loading-spinner" aria-hidden="true" /><span>{label}</span>
      {progress !== null && <progress value={progress} max="100">{progress}%</progress>}
    </div>
  </article>;
}
