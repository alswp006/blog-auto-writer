import { NextResponse } from "next/server";

export interface ErrorBody {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
}

export function jsonError(
  status: number,
  code: string,
  message: string,
  fields?: Record<string, string>,
): NextResponse<ErrorBody> {
  const body: ErrorBody = { error: { code, message } };
  if (fields !== undefined) {
    body.error.fields = fields;
  }
  return NextResponse.json(body, { status });
}
