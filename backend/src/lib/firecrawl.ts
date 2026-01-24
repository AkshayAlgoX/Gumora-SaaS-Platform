import Firecrawl from '@mendable/firecrawl-js';

export function getFirecrawl() {
  const apiKey = process.env.FIRECRAWL_API_KEY!;

  if (!apiKey) throw new Error("Firecrawl api key is missing");

  return new Firecrawl({ apiKey });
}

export async function firecrawlSearch(args: { query: string; limit: number }) {
  const apiKey = process.env.FIRECRAWL_API_KEY!;

  const baseFirecrawlUri =
    process.env.FIRECRAWL_API_BASE_URL || "https://api.firecrawl.dev";
    if (!apiKey) throw new Error("Firecrawl api key is missing");

    const response = await fetch(`${baseFirecrawlUri}/v2/search`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  },
  body: JSON.stringify({
    query: args.query,
    sources: ["web"],
    limit: args.limit,
  }),
});
  
if (!response.ok)
  throw new Error("Firecrawl search failed! Please try again...");

const json: any = await response.json();
const web = json?.data?.web ?? [];

return web.map((r: any) => ({
  url: r.url,
  title: r.title,
  description: r.description,
}));


}

export const PRODUCT_DESC_SCHEMA = {
  type: 'object',
  properties: {
    description: { type: 'string' }
  },
  required: ["description"]
}

