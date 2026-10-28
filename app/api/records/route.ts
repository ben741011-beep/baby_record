import { apiError } from "@/lib/api-response";
import { createBabyRecord, listBabyRecordsByDate } from "@/models/BabyRecord";

export async function GET(request: Request) {
  try {
    const date = new URL(request.url).searchParams.get("date");
    return Response.json({ records: await listBabyRecordsByDate(date) });
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const record = await createBabyRecord(body);
    return Response.json({ record }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
