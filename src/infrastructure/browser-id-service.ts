import { unsafeBrand } from "../shared/brand";
import type { IdService } from "../ports/ids";

export function createBrowserIdService(): IdService {
  return {
    createDocumentId: () =>
      unsafeBrand<string, "DocumentId">(`doc_${crypto.randomUUID()}`),
    createSourceId: () =>
      unsafeBrand<string, "SourceId">(`src_${crypto.randomUUID()}`),
    createPageId: () =>
      unsafeBrand<string, "PageId">(`page_${crypto.randomUUID()}`),
    createObjectId: () =>
      unsafeBrand<string, "ObjectId">(`obj_${crypto.randomUUID()}`),
    createAssetId: () =>
      unsafeBrand<string, "AssetId">(`asset_${crypto.randomUUID()}`),
    createFieldId: () =>
      unsafeBrand<string, "FieldId">(`field_${crypto.randomUUID()}`),
    createTransactionId: () =>
      unsafeBrand<string, "TransactionId">(`txn_${crypto.randomUUID()}`),
  };
}
