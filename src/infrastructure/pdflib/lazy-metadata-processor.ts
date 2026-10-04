import type {
  PdfMetadataInspection,
  PdfMetadataProcessor,
  PdfMetadataRemovalOptions,
  PdfMetadataRemovalResult,
} from "../../ports/metadata";

export type MetadataProcessorLoader = () => Promise<PdfMetadataProcessor>;

async function loadBrowserMetadataProcessor(): Promise<PdfMetadataProcessor> {
  const module = await import("./browser-metadata-processor");
  return new module.BrowserMetadataProcessor();
}

export function createLazyMetadataProcessor(
  loadProcessor: MetadataProcessorLoader = loadBrowserMetadataProcessor,
): PdfMetadataProcessor {
  let processorPromise: Promise<PdfMetadataProcessor> | null = null;
  const getProcessor = () => (processorPromise ??= loadProcessor());
  return {
    async inspect(file: File): Promise<PdfMetadataInspection> {
      return (await getProcessor()).inspect(file);
    },
    async remove(
      file: File,
      options: PdfMetadataRemovalOptions,
    ): Promise<PdfMetadataRemovalResult> {
      return (await getProcessor()).remove(file, options);
    },
  };
}
