import { apiError } from "@/lib/api-response";
import { parseObjectId } from "@/lib/object-id";
import { deleteBabyRecord, finishRangeRecord } from "@/models/BabyRecord";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as { endTime?: unknown };
    const record = await finishRangeRecord(parseObjectId(id), body.endTime);
    if (!record) return Response.json({ error: "找不到紀錄" }, { status: 404 });
    return Response.json({ record });
  } catch (error) {
    return apiError(error);
  }
}
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const result = await deleteBabyRecord(parseObjectId(id));
    if (!result.record) {
      return Response.json({ error: "找不到紀錄", deletedCount: 0 }, { status: 404 });
    }
    return Response.json(result);
  } catch (error) {
    return apiError(error);
  }
}
