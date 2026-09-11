import type { AssetDescriptor } from "../domain/document";
import type { AssetId } from "../domain/primitives";

export interface AcceptedAsset {
  readonly bytes: Blob;
  readonly mediaType: "image/png" | "image/jpeg";
  readonly pixelWidth: number;
  readonly pixelHeight: number;
}

export interface AssetRepository {
  put(asset: AcceptedAsset): Promise<AssetDescriptor>;
  get(id: AssetId): Promise<Blob>;
  delete(id: AssetId): Promise<void>;
}
