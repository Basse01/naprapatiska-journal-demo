import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "OPENAI_API_KEY saknas i .env.local" }, { status: 500 });
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File;
    if (!audioFile) return NextResponse.json({ error: "Ingen ljudfil bifogad" }, { status: 400 });

    const openaiFormData = new FormData();
    openaiFormData.append("file", audioFile, "recording.webm");
    openaiFormData.append("model", "whisper-1");
    openaiFormData.append("language", "sv");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: openaiFormData,
    });

    if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error?.message || "OpenAI API fel"); }
    const data = await response.json();
    return NextResponse.json({ text: data.text });
  } catch (error: any) {
    console.error("Transcription error:", error);
    return NextResponse.json({ error: "Transkribering misslyckades: " + error.message }, { status: 500 });
  }
}
