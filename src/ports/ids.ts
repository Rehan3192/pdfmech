import type {
  AssetId,
  DocumentId,
  FieldId,
  ObjectId,
  PageId,
  SourceId,
  TransactionId,
} from "../domain/primitives";

export interface IdService {
  createDocumentId(): DocumentId;
  createSourceId(): SourceId;
  createPageId(): PageId;
  createObjectId(): ObjectId;
  createAssetId(): AssetId;
  createFieldId(): FieldId;
  createTransactionId(): TransactionId;
}
