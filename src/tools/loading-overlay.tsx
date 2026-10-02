import { tr } from "../localization.ts";
import { lockPageScroll } from "./scroll-lock.ts";
import { renderToStaticMarkup } from "react-dom/server";

let activeLoaders = 0;

const nextPaint = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

const overlay = (message) => {
  const element = document.createElement("div") as HTMLDivElement & { releaseScrollLock: () => void };
  element.className = "loading-overlay";
  element.setAttribute("role", "status");
  element.setAttribute("aria-live", "assertive");
  element.innerHTML = renderToStaticMarkup(<div className="loading-indicator"><span className="loading-spinner" aria-hidden="true" /><span>{message}</span></div>);
  document.body.append(element);
  element.releaseScrollLock = lockPageScroll();
  return element;
};

export async function withLoading(task, message = tr("processing")) {
  const existing = document.querySelector<HTMLDivElement & { releaseScrollLock: () => void }>(".loading-overlay");
  const element = existing || overlay(message);
  activeLoaders += 1;
  await nextPaint();
  try {
    return await task();
  } finally {
    activeLoaders -= 1;
    if (!activeLoaders) { element.releaseScrollLock(); element.remove(); }
  }
}

window.withLoading = withLoading;
