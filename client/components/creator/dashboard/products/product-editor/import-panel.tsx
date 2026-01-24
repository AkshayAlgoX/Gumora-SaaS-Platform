"use client";

import {
  Candidate,
  FirecrawlScrapeRes,
  FirecrawlSearchRes,
  IngestRes,
  ProductRes,
  SearchResult,
} from "@/lib/types/product";
import { useMemo, useState } from "react";
import { PanelCard } from "./panel-card";
import { ImportModeTabs } from "./import-mode-tabs";
import { TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ResultRow } from "./result-row";
import { apiClient } from "@/lib/api/client";
import { Card } from "@/components/ui/card";

const MODES = ["search", "scrape"] as const;
type Mode = (typeof MODES)[number];

function isMode(v: string): v is Mode {
  return (MODES as readonly string[]).includes(v);
}

function ImportPanel({
  productId,
  onAfterIngest,
}: {
  productId: string;
  onAfterIngest: () => Promise<void>;
}) {
  const [mode, setMode] = useState<Mode>("search");
  const [loading, setLoading] = useState(false);

  // search state
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  // scrape states
  const [urlInput, setUrlInput] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedMap, setSelectedMap] = useState<Record<string, boolean>>({});
  const [extractedDescription, setExtractedDescription] = useState("");

  const selected = useMemo(
    () => candidates.filter((c) => selectedMap[c.url]),
    [candidates, selectedMap]
  );

  async function onHandleSearch() {
    setLoading(true);
    setSearchResults([]);

    try {
      const res = await apiClient.post<FirecrawlSearchRes>(
        `/api/creator/products/${productId}/firecrawl/search`,
        {
          query,
          limit: 8,
        }
      );

      if (res?.data?.ok) {
        setSearchResults(res?.data.results ?? []);
      }
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  }

  async function onRunQuickImport(url: string) {
    setLoading(true);
    setSearchResults([]);
    setCandidates([]);
    setSelectedMap({});
    setExtractedDescription("");

    try {
      const res = await apiClient.post<FirecrawlScrapeRes>(
        `/api/creator/products/${productId}/firecrawl/scrape`,
        { url }
      );

      if (res?.data?.ok) {
        setCandidates(res?.data?.candidates ?? []);
        setExtractedDescription(res?.data?.extracted?.description ?? "");
      }
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  }

  async function applyDescriptionToProduct() {
    const desc = extractedDescription.trim();
    if (!desc) return;

    setLoading(true);

    try {
      const res = await apiClient.patch<ProductRes>(
        `/api/creator/products/${productId}`,
        {
          description: desc,
        }
      );

      if (!res.data.ok) throw new Error("Failed to apply the description");
      await onAfterIngest();

      console.log(res);
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  }

  async function ingestSelected() {
    setLoading(true);

    try {
      const response = await apiClient.post<IngestRes>(
        `/api/creator/products/${productId}/assets/ingest`,
        { selected }
      );

      if (!response.data.ok) throw new Error("Ingest failed");

      await onAfterIngest();
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  }

  function toggle(url: string) {
    setSelectedMap((item) => ({ ...item, [url]: !item[url] }));
  }

  return (
    <div className="space-y-6">
      <PanelCard title="Import Suite (Firecrawl)" />
      <ImportModeTabs
        value={mode}
        onValueChange={(v) => {
          if (isMode(v)) setMode(v);
        }}
      >
        <TabsContent value="search" className="space-y-4">
          <PanelCard title="Search Pages">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Example: search 4k mountain images..."
                className="h-10 sm:flex-1 rounded-none bg-card shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              <Button
                disabled={loading || !query.trim()}
                onClick={onHandleSearch}
                className="inline-flex h-10 sm:w-40 hover:bg-[#ff90e8] hover:text-black items-center justify-center gap-2 rounded-none border border-border bg-[#ff90e8] cursor-pointer px-4 text-sm font-medium text-black"
              >
                {loading ? "Searching..." : "Search"}
              </Button>
            </div>

            <div className="mt-4 grid gap-3">
              {searchResults.length
                ? searchResults.map((res) => (
                    <ResultRow
                      key={res.url}
                      title={res.title}
                      description={res.description}
                      url={res.url}
                      actions={
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={loading}
                            onClick={() => {
                              setMode("scrape");
                              //
                              setUrlInput(res.url);
                              //
                              void onRunQuickImport(res.url);
                            }}
                            className="inline-flex h-10  hover:bg-[#ff90e8] hover:text-black items-center justify-center gap-2 rounded-none border border-border bg-[#ff90e8] cursor-pointer px-4 text-sm font-medium text-black"
                          >
                            Quick Import
                          </Button>
                        </>
                      }
                    />
                  ))
                : null}
            </div>
          </PanelCard>
        </TabsContent>

        {/* later */}
        <TabsContent value="scrape" className="space-y-4">
          <PanelCard title="Quick import: Scrape one page">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={urlInput}
                onChange={(event) => setUrlInput(event.target.value)}
                placeholder="Example.com"
                className="h-10 sm:flex-1 rounded-none bg-card shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              <Button
                disabled={loading || !urlInput.trim()}
                onClick={() => void onRunQuickImport(urlInput.trim())}
                className="inline-flex h-10 sm:w-40 hover:bg-[#ff90e8] hover:text-black items-center justify-center gap-2 rounded-none border border-border bg-[#ff90e8] cursor-pointer px-4 text-sm font-medium text-black"
              >
                {loading ? "Importing..." : "Import"}
              </Button>
            </div>
          </PanelCard>
          <PanelCard
            title="Generated Description"
            right={
              <Button
                disabled={loading || !extractedDescription.trim()}
                className="inline-flex mt-2 h-10 sm:w-40 hover:bg-[#ff90e8] hover:text-black items-center justify-center gap-2 rounded-none border border-border bg-[#ff90e8] cursor-pointer px-4 text-sm font-medium text-black"
                onClick={() => void applyDescriptionToProduct()}
              >
                Apply
              </Button>
            }
          >
            <div className="border border-border bg-background p-5">
              {extractedDescription.trim() ? (
                <p className="whitespace-pre-wrap text-sm text-foreground/90">
                  {extractedDescription.trim()}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Run quick import to generate a description
                </p>
              )}
            </div>
          </PanelCard>
        </TabsContent>
      </ImportModeTabs>

      {candidates.length ? (
        <Card className="rounded-none border border-border bg-card p-5 md:p-6 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-base font-medium">Candidates</div>
              <div>
                {candidates.length} found and {selected.length} selected
              </div>
            </div>
            <Button
              disabled={loading || selected.length === 0}
              onClick={() => void ingestSelected()}
              className="inline-flex mt-2 h-10 sm:w-40 hover:bg-[#ff90e8] hover:text-black items-center justify-center gap-2 rounded-none border border-border bg-[#ff90e8] cursor-pointer px-4 text-sm font-medium text-black"
            >
              {loading ? "Ingesting..." : "Ingest"}
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
            {candidates.map((c) => {
              const checked = !!selectedMap[c.url];

              return (
                <label
                  key={c.url}
                  className={
                    "cursor-pointer border border-border bg-background transition hover:bg-muted/20" +
                    (checked ? "ring-1 ring-primary/70" : "")
                  }
                >
                  <div className="flex items-center justify-between border-b border-border bg-card px-2 py-2 text-[11px]">
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(c.url)}
                      />
                      {checked ? "Selected" : "Select"}
                    </span>
                  </div>
                  <div className="aspect-4/3 w-full bg-muted">
                    <img
                      src={c.url}
                      alt="candidate"
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                </label>
              );
            })}
          </div>
        </Card>
      ) : null}
    </div>
  );
}

export default ImportPanel;
