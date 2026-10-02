import type { Translator } from "./localization";

declare global {
  interface Window {
    tr: Translator;
    UTIF: {
      decode: (bytes: ArrayBuffer) => Array<{ width: number; height: number }>;
      decodeImage: (bytes: ArrayBuffer, page: object) => void;
      toRGBA8: (page: object) => Uint8Array;
    };
    withLoading: <T>(task: () => T | Promise<T>, message?: string) => Promise<T>;
    lockPageScroll: (allowedElement?: Element | null) => () => void;
    showPdfPreview: (bytes: Uint8Array | ArrayBuffer, filename?: string) => Promise<void>;
  }
}
