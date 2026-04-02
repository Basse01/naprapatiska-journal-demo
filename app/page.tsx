"use client";

import { useState, useRef, useCallback } from "react";

const SECTIONS = [
  "ANAMNES",
  "INSPEKTION",
  "ORTOPEDISKA TESTER",
  "DIAGNOS",
  "LEDJUSTERING",
  "MANIPULATION RYGGRAD",
  "HEMÖVNINGAR",
  "MUSKELBEHANDLING",
  "MEDICINER",
  "TIDIGARE TRAUMAN",
  "ÖVRIGT",
];

function parseJournal(text: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (let i = 0; i < SECTIONS.length; i++) {
    const current = SECTIONS[i];
    const next = SECTIONS[i + 1];

    const start = text.indexOf(current);
    if (start === -1) { result[current] = ""; continue; }

    const contentStart = start + current.length;
    const end = next ? text.indexOf(next, contentStart) : text.length;
    result[current] = text.slice(contentStart, end !== -1 ? end : text.length).trim();
  }

  return result;
}

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState("");
  const [interimText, setInterimText] = useState("");
  const [rawFormatted, setRawFormatted] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [hasFormatted, setHasFormatted] = useState(false);
  const [isFormatting, setIsFormatting] = useState(false);
  const [viewMode, setViewMode] = useState<"sections" | "combined">("sections");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [error, setError] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const finalTranscriptRef = useRef("");
  const recordingStartRef = useRef<number>(0);

  const startRecording = async () => {
    try {
      setError("");
      setTranscription("");
      setInterimText("");
      finalTranscriptRef.current = "";

      const tokenRes = await fetch("/api/deepgram-token");
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) throw new Error(tokenData.error || "Kunde inte hämta token");

      const ws = new WebSocket(
        `wss://api.eu.deepgram.com/v1/listen?language=sv&model=nova-2&interim_results=true&endpointing=300&mip_opt_out=true`,
        ["token", tokenData.token]
      );
      wsRef.current = ws;

      ws.onopen = async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            ws.send(event.data);
          }
        };

        mediaRecorder.start(250);
        recordingStartRef.current = Date.now();
        setIsRecording(true);
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        const transcript = data.channel?.alternatives?.[0]?.transcript;
        if (!transcript) return;

        if (data.is_final) {
          finalTranscriptRef.current += (finalTranscriptRef.current ? " " : "") + transcript;
          setTranscription(finalTranscriptRef.current);
          setInterimText("");
        } else {
          setInterimText(transcript);
        }
      };

      ws.onerror = () => setError("WebSocket-anslutning till Deepgram misslyckades");
      ws.onclose = () => setInterimText("");
    } catch (err: any) {
      setError(err.message || "Kunde inte starta inspelning. Kontrollera mikrofonbehörighet.");
    }
  };

  const stopRecording = useCallback(() => {
    const audioSeconds = recordingStartRef.current
      ? Math.round((Date.now() - recordingStartRef.current) / 1000)
      : 0;

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "CloseStream" }));
      wsRef.current.close();
    }
    setIsRecording(false);
    setInterimText("");

    if (audioSeconds > 0) {
      fetch("/api/log-usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioSeconds }),
      }).catch(() => {});
    }
  }, []);

  const formatToJournal = async () => {
    if (!transcription) return;
    setIsFormatting(true);
    setError("");
    try {
      const response = await fetch("/api/format", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: transcription }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Formatering misslyckades");
      setRawFormatted(data.formattedText);
      setFields(parseJournal(data.formattedText));
      setHasFormatted(true);
    } catch (err: any) {
      setError(err.message || "Ett fel uppstod vid formatering");
    } finally {
      setIsFormatting(false);
    }
  };

  const copyField = async (section: string) => {
    try {
      await navigator.clipboard.writeText(fields[section] || "");
      setCopiedField(section);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      setError("Kunde inte kopiera till urklipp");
    }
  };

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(rawFormatted);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch {
      setError("Kunde inte kopiera till urklipp");
    }
  };

  return (
    <main className="min-h-screen bg-white">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-[1200px] mx-auto px-6 py-8">
          <div className="text-center">
            <h1 className="text-3xl font-semibold tracking-wide text-[#009083]">NAPRAPATISKA INSTITUTET</h1>
          </div>
        </div>
      </header>

      <section className="bg-white pb-12 text-center border-b border-gray-200">
        <div className="max-w-[800px] mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-semibold text-[#1a1a1a] mb-4">AI-driven Journalföring</h2>
          <p className="text-gray-500 text-base">Effektivisera din dokumentation med röstinspelning</p>
        </div>
      </section>

      <div className="bg-[#f5f5f5] min-h-screen py-12 px-4">
        <div className="max-w-[900px] mx-auto">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg mb-8">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span>{error}</span>
              </div>
            </div>
          )}

          <section className="bg-white rounded-2xl p-8 mb-8 shadow-sm border border-gray-100">
            <h2 className="text-2xl font-semibold text-[#1a1a1a] mb-8 text-center">Röstinspelning</h2>
            <div className="flex flex-col items-center">
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`w-[160px] h-[160px] rounded-full flex items-center justify-center transition-all duration-300 border-2 ${isRecording ? "bg-red-50 border-red-500 animate-pulse" : "bg-[#009083]/10 border-[#009083] hover:bg-[#009083]/20"}`}
              >
                {isRecording ? (
                  <svg className="w-16 h-16 text-red-500" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                ) : (
                  <svg className="w-16 h-16 text-[#009083]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                  </svg>
                )}
              </button>
              <p className="mt-6 text-gray-500 font-medium text-lg">
                {isRecording ? "Inspelning pågår... Klicka för att stoppa" : "Klicka för att börja spela in"}
              </p>
            </div>
          </section>

          <section className="bg-white rounded-2xl p-8 mb-8 shadow-sm border border-gray-100">
            <h2 className="text-2xl font-semibold text-[#1a1a1a] mb-6">Transkribering</h2>
            <div className="relative">
              <textarea
                readOnly
                value={transcription + (interimText ? (transcription ? " " : "") + interimText : "")}
                placeholder="Transkriberad text visas här i realtid..."
                className="w-full h-[160px] p-5 bg-[#f8f8f8] border border-gray-200 rounded-xl resize-none text-[#333] text-base placeholder-gray-400 focus:outline-none focus:border-[#009083] transition-colors"
              />
              {isRecording && (
                <div className="absolute top-3 right-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-xs text-red-500 font-medium">LIVE</span>
                </div>
              )}
            </div>
            <button
              onClick={formatToJournal}
              disabled={!transcription || isRecording || isFormatting}
              className="mt-6 w-full py-4 px-8 bg-[#009083] text-white font-semibold text-base tracking-wide rounded-lg transition-all duration-200 hover:bg-[#007a70] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isFormatting ? (
                <span className="flex items-center justify-center gap-3">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Formaterar...
                </span>
              ) : (
                "FORMATERA TILL JOURNAL"
              )}
            </button>
          </section>

          {hasFormatted && (
            <>
              {/* View mode toggle */}
              <div className="flex items-center gap-2 mb-4 bg-white rounded-xl p-1.5 shadow-sm border border-gray-100 w-fit">
                <button
                  onClick={() => setViewMode("sections")}
                  className={`px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${viewMode === "sections" ? "bg-[#009083] text-white shadow-sm" : "text-gray-500 hover:text-[#009083]"}`}
                >
                  Sektioner
                </button>
                <button
                  onClick={() => setViewMode("combined")}
                  className={`px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${viewMode === "combined" ? "bg-[#009083] text-white shadow-sm" : "text-gray-500 hover:text-[#009083]"}`}
                >
                  All text
                </button>
              </div>

              {viewMode === "sections" ? (
                <div className="space-y-4">
                  {SECTIONS.map((section) => (
                    <section key={section} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-[#009083] tracking-widest uppercase">{section}</h3>
                        <button
                          onClick={() => copyField(section)}
                          disabled={!fields[section]}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed bg-[#f5f5f5] border border-gray-200 text-gray-500 hover:border-[#009083] hover:text-[#009083]"
                        >
                          {copiedField === section ? (
                            <>
                              <svg className="w-3.5 h-3.5 text-[#009083]" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              <span className="text-[#009083]">Kopierat</span>
                            </>
                          ) : (
                            <>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              Kopiera
                            </>
                          )}
                        </button>
                      </div>
                      <textarea
                        value={fields[section] || ""}
                        onChange={(e) => setFields((prev) => ({ ...prev, [section]: e.target.value }))}
                        placeholder="—"
                        rows={fields[section] ? Math.max(2, fields[section].split("\n").length + 1) : 2}
                        className="w-full p-4 bg-[#f8f8f8] border border-gray-200 rounded-xl resize-none text-[#333] text-sm placeholder-gray-300 focus:outline-none focus:border-[#009083] transition-colors"
                      />
                    </section>
                  ))}
                </div>
              ) : (
                <section className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-[#009083] tracking-widest uppercase">Fullständig journal</h3>
                    <button
                      onClick={copyAll}
                      className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-md transition-all duration-150 bg-[#009083] text-white hover:bg-[#007a70]"
                    >
                      {copiedAll ? (
                        <>
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          Kopierat!
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          Kopiera allt
                        </>
                      )}
                    </button>
                  </div>
                  <textarea
                    value={rawFormatted}
                    onChange={(e) => setRawFormatted(e.target.value)}
                    rows={Math.max(10, rawFormatted.split("\n").length + 2)}
                    className="w-full p-5 bg-[#f8f8f8] border border-gray-200 rounded-xl resize-none text-[#333] text-sm focus:outline-none focus:border-[#009083] transition-colors"
                  />
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
