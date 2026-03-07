import { NextResponse } from "next/server";
import { vectorStore } from "@/lib/vectorStore";
import { answerQuestionWithRag } from "@/lib/ragPipeline";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { question } = (await request.json()) as { question?: string };

    if (!question || typeof question !== "string") {
      return NextResponse.json(
        { error: "question is required." },
        { status: 400 }
      );
    }

    if ((await vectorStore.size()) === 0) {
      return NextResponse.json(
        { error: "No repository indexed. Run ingestion first." },
        { status: 400 }
      );
    }

    const result = await answerQuestionWithRag(question);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Query failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
