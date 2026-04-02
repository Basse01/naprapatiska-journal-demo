import { NextRequest, NextResponse } from "next/server";
import { logAzureUsage } from "@/lib/usage";

const AZURE_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT!;
const AZURE_API_KEY = process.env.AZURE_OPENAI_API_KEY!;
const AZURE_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT!;
const AZURE_API_VERSION = "2024-08-01-preview";

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();
    if (!text) return NextResponse.json({ error: "Ingen text att formatera" }, { status: 400 });

    const url = `${AZURE_ENDPOINT}/openai/deployments/${AZURE_DEPLOYMENT}/chat/completions?api-version=${AZURE_API_VERSION}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": AZURE_API_KEY,
      },
      body: JSON.stringify({
        messages: [{
          role: "user",
          content: `Du är en journalassistent för Naprapatiska Institutet. Din uppgift är att DIREKT formatera talade anteckningar till journaltext enligt klinikens mall — fråga ALDRIG efter mer information.

VIKTIGT:
- Formatera ALLTID texten direkt med den information som finns
- Fråga ALDRIG efter mer detaljer eller förtydliganden
- Om information saknas för ett fält, lämna det tomt — behandlaren fyller i efterhand
- Om texten är helt irrelevant för journalföring, svara ENDAST med: "Detta verktyg är avsett för medicinsk journalföring. Var god ange patientrelaterad information."

JOURNALMALL (använd exakt denna struktur):

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
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`${response.status} ${err}`);
    }

    const data = await response.json();
    const formattedText = data.choices[0].message.content;

    const inputTokens = data.usage?.prompt_tokens || 0;
    const outputTokens = data.usage?.completion_tokens || 0;
    await logAzureUsage(inputTokens, outputTokens);

    return NextResponse.json({ formattedText });
  } catch (error: any) {
    console.error("Formatting error:", error);
    return NextResponse.json({ error: "Formatering misslyckades: " + error.message }, { status: 500 });
  }
}
