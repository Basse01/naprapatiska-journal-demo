import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(request: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "ANTHROPIC_API_KEY saknas i .env.local" }, { status: 500 });

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const { text } = await request.json();
    if (!text) return NextResponse.json({ error: "Ingen text att formatera" }, { status: 400 });

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: `Du är en journalformaterare för Naprapatiska Institutet. Din uppgift är att DIREKT formatera talade anteckningar till journaltext — fråga ALDRIG efter mer information.

VIKTIGT:
- Formatera ALLTID texten direkt med den information som finns
- Fråga ALDRIG efter mer detaljer eller förtydliganden
- Om information saknas för ett fält, lämna det TOMT — behandlaren fyller i efterhand
- Om texten är helt irrelevant för journalföring, svara ENDAST med: "Detta verktyg är avsett för medicinsk journalföring. Var god ange patientrelaterad information."

MALL (använd exakt denna struktur):

ANAMNES
Sökorsak:
Smärtbeskrivning:
Duration och förlopp:
Utlösande/lindrande faktorer:
Tidigare besvär/behandling:
Allmäntillstånd:

UNDERSÖKNING
Inspektion:
Rörelsetest:
Palpation:
Neurologisk undersökning:

DIAGNOS

BEHANDLING
Utförd behandling:
Teknik:

RÅD & UPPFÖLJNING
Egenvård/träning:
Återbesök:
Notering:

Anteckningar att formatera:
${text}`,
      }],
    });

    const formattedText = message.content[0].type === "text" ? message.content[0].text : "";
    return NextResponse.json({ formattedText });
  } catch (error: any) {
    console.error("Formatting error:", error);
    return NextResponse.json({ error: "Formatering misslyckades: " + error.message }, { status: 500 });
  }
}
