/**
 * Health Check Endpoint
 * GET /api/health_check
 * 
 * Used by Railway to verify the application is running
 */

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "mymirro-chat-api",
  });
}

