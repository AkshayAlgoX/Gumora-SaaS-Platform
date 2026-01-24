export type ProductVisibility = "draft" | "published";

export type Product = {
  _id: string;
  title: string;
  description?: string;
  price: number;
  currency?: "INR";
  visibility: ProductVisibility;
  slug: string;
  coverImageAssetId: string | null;
  stats: { assetCount: number; soldCount: number };
};

export type ImageAsset = {
  _id: string;

  cloudinary?: {
    secureUrl?: string;
    publicId?: string;
    folder?: string;
    assetId?: string;
  };

  meta?: {
    filename?: string;
    contentType?: string;
    sizeBytes?: number;
    width?: number;
    height?: number;
  };

  source?: {
    sourceUrl?: string;
    sourcePageUrl?: string;
  };

  orderIndex?: number;

  createdAt?: string;
  updatedAt?: string;
};

export type SearchResult = {
  url: string;
  title?: string;
  description?: string;
};

export type Candidate = {
  url: string;
  sourcePageUrl?: string;
};

export type ScanPage = {
  url: string;
  title?: string;
  description?: string;
};

export type ApiOk<T> = { ok: true } & T;
export type ApiErr = { ok: false; error?: string };

export type ProductRes = ApiOk<{ product: Product }> | ApiErr;
export type AssetsRes = ApiOk<{ assets: ImageAsset[] }> | ApiErr;

export type FirecrawlSearchRes = ApiOk<{ results: SearchResult[] }> | ApiErr;


export type FirecrawlScrapeRes =
  | ApiOk<{
      candidates: Candidate[];
      extracted?: { description?: string };
    }>
  | ApiErr;

export type IngestRes =
  | ApiOk<{
      created: ImageAsset[];
      failed: Array<{ url: string; reason: string }>;
    }>
  | ApiErr;
