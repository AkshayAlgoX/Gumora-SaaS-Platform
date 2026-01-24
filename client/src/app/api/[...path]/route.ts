import { NextRequest, NextResponse } from "next/server";

interface Params {
  path: string[];
}

export async function GET(req: NextRequest, { params }: { params: Params }) {
  return handle(req, params);
}

export async function POST(req: NextRequest, { params }: { params: Params }) {
  return handle(req, params);
}

export async function PUT(req: NextRequest, { params }: { params: Params }) {
  return handle(req, params);
}

export async function DELETE(req: NextRequest, { params }: { params: Params }) {
  return handle(req, params);
}

async function handle(req: NextRequest, params: Params) {
  try {
    const pathStr = params.path.join("/");
    const backendUrl = `${process.env.NEXT_PUBLIC_API_URL}/api/${pathStr}`;

    console.log(`[Proxy] ${req.method} ${backendUrl}`);

    const body =
      req.method === "GET" ? undefined : await req.text();

    const backendRes = await fetch(backendUrl, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        cookie: req.headers.get("cookie") || "",
      },
      body: body,
      credentials: "include",
    });

    const data = await backendRes.text();

    const res = new NextResponse(data, {
      status: backendRes.status,
      headers: {
        "Content-Type": "application/json",
      },
    });

    const setCookie = backendRes.headers.get("set-cookie");
    if (setCookie) {
      res.headers.set("set-cookie", setCookie);
    }

    return res;
  } catch (error) {
    console.error("[Proxy Error]", error);
    return new NextResponse(
      JSON.stringify({ ok: false, error: "Proxy error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
