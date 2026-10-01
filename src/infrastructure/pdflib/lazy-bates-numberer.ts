import type {
  BatesInspection,
  BatesNumberer,
  BatesProcessOptions,
  BatesProcessResult,
  BatesProgress,
  BatesFileRequest,
} from "../../ports/bates";

export type BatesNumbererLoader = () => Promise<BatesNumberer>;

async function loadBrowserBatesNumberer(): Promise<BatesNumberer> {
  const module = await import("./browser-bates-numberer");
  return new module.BrowserBatesNumberer();
}

export function createLazyBatesNumberer(
  loadNumberer: BatesNumbererLoader = loadBrowserBatesNumberer,
): BatesNumberer {
  let numbererPromise: Promise<BatesNumberer> | null = null;
  const getNumberer = () => (numbererPromise ??= loadNumberer());
  return {
    async inspect(file: File): Promise<BatesInspection> {
      return (await getNumberer()).inspect(file);
    },
    async process(
      files: readonly BatesFileRequest[],
      options: BatesProcessOptions,
      onProgress: (progress: BatesProgress) => void,
    ): Promise<BatesProcessResult> {
      return (await getNumberer()).process(files, options, onProgress);
    },
  };
}

