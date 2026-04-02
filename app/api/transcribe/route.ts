import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    if (!process.env.DEEPGRAM_API_KEY) return NextResponse.json({ error: "DEEPGRAM_API_KEY saknas i .env.local" }, { status: 500 });
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File;
    if (!audioFile) return NextResponse.json({ error: "Ingen ljudfil bifogad" }, { status: 400 });

    const audioBuffer = Buffer.from(await audioFile.arrayBuffer());

    const response = await fetch("https://api.eu.deepgram.com/v1/listen?language=sv&model=nova-2&smart_format=true&mip_opt_out=true", {
      method: "POST",
      headers: {
        Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
        "Content-Type": audioFile.type || "audio/webm",
      },
      body: audioBuffer,
    });

    if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.err_msg || "Deepgram API fel"); }
    const data = await response.json();
    const text = data.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";

    return NextResponse.json({ text });
  } catch (error: any) {
    console.error("Transcription error:", error);
    return NextResponse.json({ error: "Transkribering misslyckades: " + error.message }, { status: 500 });
  }
}
