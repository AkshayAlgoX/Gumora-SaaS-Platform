"use client";

import { Button } from "@/components/ui/button";
import { ImageAsset } from "@/lib/types/product";

export default function AssetsGrid({
  assets,
  title,
  actionLabel,
  isActionActive,
  onAction,
  emptyText,
}: {
  assets: ImageAsset[];
  title: string;
  actionLabel?: (asset: ImageAsset) => string;
  isActionActive: (asset: ImageAsset) => Boolean;
  onAction: (asset: ImageAsset) => void;
  emptyText: string;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-base font-medium">{title}</div>
          <div className="text-xs text-muted-foreground">
            {assets.length} Total
          </div>
        </div>
      </div>

      {assets.length === 0 ? (
        <p className="text-md text-muted-foreground">{emptyText}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {assets.map((asset) => {
            const url = asset.cloudinary?.secureUrl;
            const active = isActionActive?.(asset) ?? false;

            return (
              <div
                key={asset._id}
                className={`group relative overflow-hidden border border-border bg-background hover:bg-muted/20 transition ${
                  active ? "ring-1 ring-primary/70" : ""
                }`}
              >
                <div className="aspect-4/3 w-full bg-muted">
                  {url ? (
                    <img
                      src={url}
                      alt="asset"
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                    />
                  ) : null}
                </div>
                {active ? (
                  <div className="absolute left-2 top-2 border border-border bg-card px-2 py-1 text-[11px] font-medium">
                    Cover
                  </div>
                ) : null}

                {actionLabel && onAction ? (
                  <div className="pointer-events-none absolute inset-x-2 bottom-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      className={`pointer-events-auto w-full rounded-none border-0 shadow-none
                            ${
                              active
                                ? "bg-muted text-foreground hover:bg-muted"
                                : "bg-[#ff90eb] text-black hover:bg-[#ff90eb]"
                            } 
                            `}
                      onClick={() => onAction(asset)}
                    >
                      {active ? "Cover" : actionLabel(asset)}
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
