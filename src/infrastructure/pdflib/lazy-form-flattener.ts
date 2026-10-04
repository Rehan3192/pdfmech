import type { FlattenFormResult, FormFlattener, FormInspection } from "../../ports/form-flattener";

export type FormFlattenerLoader = () => Promise<FormFlattener>;

async function loadBrowserFormFlattener(): Promise<FormFlattener> {
  const module = await import("./browser-form-flattener");
  return new module.BrowserFormFlattener();
}

export function createLazyFormFlattener(
  loadFlattener: FormFlattenerLoader = loadBrowserFormFlattener,
): FormFlattener {
  let flattenerPromise: Promise<FormFlattener> | null = null;
  const getFlattener = () => (flattenerPromise ??= loadFlattener());
  return {
    async inspect(file: File): Promise<FormInspection> {
      return (await getFlattener()).inspect(file);
    },
    async flatten(file: File): Promise<FlattenFormResult> {
      return (await getFlattener()).flatten(file);
    },
  };
}

