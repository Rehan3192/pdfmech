import { describe, expect, it, vi } from "vitest";

import { createLazyOcrProcessor } from "../../src/infrastructure/ocr/lazy-ocr-processor";
import type { OcrProcessor } from "../../src/ports/ocr";

describe("lazy OCR processor", () => {
  it("loads the browser adapter once, only when OCR is requested", async () => {
    const inspect = vi.fn<OcrProcessor["inspect"]>().mockResolvedValue({
      fileName: "scan.pdf",
      byteLength: 4,
      pageCount: 1,
      pages: [],
    });
    const processor: OcrProcessor = {
      inspect,
      process: vi.fn(),
    };
    const loadProcessor = vi.fn().mockResolvedValue(processor);
    const lazyProcessor = createLazyOcrProcessor(loadProcessor);
    const file = new File(["%PDF"], "scan.pdf", { type: "application/pdf" });

    expect(loadProcessor).not.toHaveBeenCalled();
    await lazyProcessor.inspect(file);
    await lazyProcessor.inspect(file);

    expect(loadProcessor).toHaveBeenCalledTimes(1);
    expect(inspect).toHaveBeenCalledTimes(2);
  });
});
