import { apiError } from "@/lib/api-response";
import { parseObjectId } from "@/lib/object-id";
import { countBabyRecordsByType } from "@/models/BabyRecord";
import {
  deleteCustomRecordType,
  setRecordTypeVisibility,
} from "@/models/RecordType";

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

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const recordTypeId = parseObjectId(id);
    const usageCount = await countBabyRecordsByType(recordTypeId);
    if (usageCount > 0) {
      return Response.json(
        { error: `這個項目仍有 ${usageCount} 筆紀錄，無法刪除` },
        { status: 409 },
      );
    }

    const result = await deleteCustomRecordType(recordTypeId);
    if (!result.recordType) {
      return Response.json(
        { error: "找不到記錄類型", deletedCount: 0 },
        { status: 404 },
      );
    }
    return Response.json(result);
  } catch (error) {
    return apiError(error);
  }
}
