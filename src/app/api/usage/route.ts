import { NextResponse } from 'next/server';
import { Guardrails } from '@/lib/llm/guardrails';

export async function GET() {
    return NextResponse.json(Guardrails.getUsageStats());
}
