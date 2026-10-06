import type { SplitPdfProcessor } from "../../ports/split-pdf";

export function createLazyPdfSplitter(): SplitPdfProcessor {
  return {
    async inspect(file, onProgress, signal) {
      const { BrowserPdfSplitter } = await import("./browser-pdf-splitter");
      return new BrowserPdfSplitter().inspect(file, onProgress, signal);
    },
    async split(file, groups, onProgress, signal) {
      const { BrowserPdfSplitter } = await import("./browser-pdf-splitter");
      return new BrowserPdfSplitter().split(file, groups, onProgress, signal);
    },
  };
}
