import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "DEEPGRAM_API_KEY saknas" }, { status: 500 });
  return NextResponse.json({ token: apiKey });
}
