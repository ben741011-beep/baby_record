import { apiError } from "@/lib/api-response";
import { parseObjectId } from "@/lib/object-id";
import { setRecordTypeVisibility } from "@/models/RecordType";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as { isVisible?: unknown };
    if (typeof body.isVisible !== "boolean") throw new Error("顯示狀態不正確");
    const recordType = await setRecordTypeVisibility(
      parseObjectId(id),
      body.isVisible,
    );
    if (!recordType) {
      return Response.json({ error: "找不到記錄類型" }, { status: 404 });
    }
    return Response.json({ recordType });
  } catch (error) {
    return apiError(error);
  }
}
