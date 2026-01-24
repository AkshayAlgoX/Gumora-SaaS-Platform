import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: any) {
  return handle(req, params);
}

export async function POST(req: NextRequest, { params }: any) {
  return handle(req, params);
}

export async function PUT(req: NextRequest, { params }: any) {
  return handle(req, params);
}

export async function DELETE(req: NextRequest, { params }: any) {
  return handle(req, params);
}

async function handle(req: NextRequest, params: { path: string[] }) {
  const backendUrl =
    `${process.env.NEXT_PUBLIC_API_URL}/api/${params.path.join("/")}`;

  const backendRes = await fetch(backendUrl, {
    method: req.method,
    headers: {
      "Content-Type": "application/json",
      cookie: req.headers.get("cookie") || "",
    },
    body:
      req.method === "GET" ? undefined : await req.text(),
    credentials: "include",
  });

  const data = await backendRes.text();

  const res = new NextResponse(data, {
    status: backendRes.status,
  });

  const setCookie = backendRes.headers.get("set-cookie");
  if (setCookie) {
    res.headers.set("set-cookie", setCookie);
  }

  return res;
}
