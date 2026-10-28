import { apiError } from "@/lib/api-response";
import { createCustomRecordType, listRecordTypes } from "@/models/RecordType";

export async function GET() {
  try {
    return Response.json({ recordTypes: await listRecordTypes() });
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      label?: unknown;
      icon?: unknown;
      kind?: unknown;
    };
    const recordType = await createCustomRecordType(body);
    return Response.json({ recordType }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
