import { NextRequest, NextResponse } from "next/server";
import { logDeepgramUsage } from "@/lib/usage";

export async function POST(request: NextRequest) {
  try {
    const { audioSeconds } = await request.json();
    if (typeof audioSeconds !== "number" || audioSeconds <= 0) {
      return NextResponse.json({ error: "Ogiltigt värde" }, { status: 400 });
    }
    await logDeepgramUsage(audioSeconds);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Log usage error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
