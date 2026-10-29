import type { Collection, Document, IndexDescription, ObjectId } from "mongodb";
import { ObjectId as MongoObjectId } from "mongodb";
import { getDatabase } from "@/lib/mongodb";
import {
  getRecordTypesCollection,
  RECORD_KINDS,
  type RecordKind,
  type RecordTypeDocument,
} from "@/models/RecordType";

export const BABY_RECORDS_COLLECTION = "babyRecords";

export interface BabyRecordDocument {
  _id: ObjectId;
  recordTypeId: ObjectId;
  kind: RecordKind;
  startedAt: Date;
  endedAt?: Date;
  category?: string;
  value?: number;
  unit?: string;
  note: string;
  createdAt: Date;
  updatedAt: Date;
}
export interface BabyRecordView {
  id: string;
  recordTypeId: string;
  kind: RecordKind;
  startedAt: string;
  endedAt?: string;
  category?: string;
  value?: number;
  unit?: string;
  note: string;
  durationMinutes?: number;
}
export const BABY_RECORD_VALIDATOR: Document = {
  $jsonSchema: {
    bsonType: "object",
    additionalProperties: false,
    required: [
      "_id",
      "recordTypeId",
      "kind",
      "startedAt",
      "note",
      "createdAt",
      "updatedAt",
    ],
    properties: {
      _id: { bsonType: "objectId" },
      recordTypeId: { bsonType: "objectId" },
      kind: { bsonType: "string", enum: [...RECORD_KINDS] },
      startedAt: { bsonType: "date" },
      endedAt: { bsonType: "date" },
      category: { bsonType: "string", minLength: 1, maxLength: 30 },
      value: { bsonType: ["int", "long", "double", "decimal"] },
      unit: { bsonType: "string", minLength: 1, maxLength: 20 },
      note: { bsonType: "string", maxLength: 500 },
      createdAt: { bsonType: "date" },
      updatedAt: { bsonType: "date" },
    },
  },
};

export const BABY_RECORD_INDEXES: IndexDescription[] = [
  { key: { startedAt: -1 }, name: "startedAt_-1" },
  {
    key: { recordTypeId: 1, startedAt: -1 },
    name: "recordTypeId_1_startedAt_-1",
  },
];

export async function getBabyRecordsCollection(): Promise<
  Collection<BabyRecordDocument>
> {
  return (await getDatabase()).collection<BabyRecordDocument>(
    BABY_RECORDS_COLLECTION,
  );
}
function parseDate(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("日期格式不正確");
  }
  return value;
}
function parseTime(value: unknown, field = "時間"): string {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw new Error(`${field}格式不正確`);
  }
  return value;
}
function taipeiDate(date: string, time: string): Date {
  const value = new Date(`${date}T${time}:00+08:00`);
  if (Number.isNaN(value.getTime())) throw new Error("日期時間格式不正確");
  return value;
}
function parseOptionalNote(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new Error("備註必須是文字");
  const note = value.trim();
  if (note.length > 500) throw new Error("備註不可超過 500 字");
  return note;
}

function parseNumber(value: unknown, field: string, options?: { min?: number; max?: number; integer?: boolean }): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) throw new Error(`${field}必須是數字`);
  if (options?.integer && !Number.isInteger(number)) throw new Error(`${field}必須是整數`);
  if (options?.min !== undefined && number < options.min) throw new Error(`${field}不可小於 ${options.min}`);
  if (options?.max !== undefined && number > options.max) throw new Error(`${field}不可大於 ${options.max}`);
  return number;
}

function parseCategory(value: unknown, allowed: readonly string[], field: string): string {
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw new Error(`${field}不正確`);
  }
  return value;
}

export function serializeBabyRecord(document: BabyRecordDocument): BabyRecordView {
  return {
    id: document._id.toHexString(),
    recordTypeId: document.recordTypeId.toHexString(),
    kind: document.kind,
    startedAt: document.startedAt.toISOString(),
    ...(document.endedAt ? { endedAt: document.endedAt.toISOString() } : {}),
    ...(document.category ? { category: document.category } : {}),
    ...(document.value !== undefined ? { value: Number(document.value) } : {}),
    ...(document.unit ? { unit: document.unit } : {}),
    note: document.note,
    ...(document.endedAt
      ? { durationMinutes: Math.round((document.endedAt.getTime() - document.startedAt.getTime()) / 60_000) }
      : {}),
  };
}

type EditableRecordFields = Pick<BabyRecordDocument, "startedAt" | "note"> &
  Partial<
    Pick<BabyRecordDocument, "endedAt" | "category" | "value" | "unit">
  >;

function parseEditableRecordFields(
  type: RecordTypeDocument,
  input: Record<string, unknown>,
): EditableRecordFields {
  const date = parseDate(input.date);
  const time = parseTime(input.time);
  const startedAt = taipeiDate(date, time);
  if (startedAt.getTime() > Date.now() + 60_000) {
    throw new Error("紀錄時間不可晚於現在");
  }

  const fields: EditableRecordFields = {
    startedAt,
    note: parseOptionalNote(input.note),
  };

  if (type.kind === "milk") {
    fields.category = parseCategory(
      input.category,
      ["母奶", "配方奶"],
      "喝奶類型",
    );
    fields.value = parseNumber(input.value, "奶量", {
      min: 0,
      max: 3000,
      integer: true,
    });
    fields.unit = "ml";
  } else if (type.kind === "diaper") {
    fields.category = parseCategory(
      input.category,
      ["小便", "大便", "兩者"],
      "尿布類型",
    );
  } else if (type.kind === "pump") {
    fields.category = parseCategory(
      input.category,
      ["左側", "右側", "兩側"],
      "擠奶側別",
    );
    fields.value = parseNumber(input.value, "奶量", {
      min: 0,
      max: 3000,
      integer: true,
    });
    fields.unit = "ml";
  } else if (type.kind === "temperature") {
    fields.value = parseNumber(input.value, "體溫", { min: 30, max: 45 });
    fields.unit = "°C";
  } else if (type.kind === "customInteger") {
    fields.value = parseNumber(input.value, "數量", {
      min: 0,
      integer: true,
    });
    fields.unit = "count";
  } else if (type.kind === "customDecimal") {
    fields.value = parseNumber(input.value, "數值");
  }

  if (type.kind === "sleep" || type.kind === "customRange") {
    if (input.endTime) {
      const endTime = parseTime(input.endTime, "結束時間");
      let endedAt = taipeiDate(date, endTime);
      if (endedAt <= startedAt) {
        endedAt = new Date(endedAt.getTime() + 86_400_000);
      }
      fields.endedAt = endedAt;
    }
  }

  return fields;
}

async function findRecordType(id: unknown): Promise<RecordTypeDocument> {
  if (typeof id !== "string" || !MongoObjectId.isValid(id)) {
    throw new Error("記錄類型不存在");
  }
  const type = await (await getRecordTypesCollection()).findOne({
    _id: new MongoObjectId(id),
  });
  if (!type) throw new Error("記錄類型不存在");
  return type;
}

export async function createBabyRecord(input: Record<string, unknown>): Promise<BabyRecordView> {
  const type = await findRecordType(input.recordTypeId);
  const fields = parseEditableRecordFields(type, input);

  const record: BabyRecordDocument = {
    _id: new MongoObjectId(),
    recordTypeId: type._id,
    kind: type.kind,
    ...fields,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const collection = await getBabyRecordsCollection();
  const result = await collection.insertOne(record);
  const inserted = await collection.findOne({ _id: result.insertedId });
  if (!inserted) throw new Error("紀錄新增後無法讀回");
  return serializeBabyRecord(inserted);
}

export async function updateBabyRecord(
  id: ObjectId,
  input: Record<string, unknown>,
): Promise<BabyRecordView | null> {
  const collection = await getBabyRecordsCollection();
  const existing = await collection.findOne({ _id: id });
  if (!existing) return null;

  const type = await findRecordType(existing.recordTypeId.toHexString());
  if (type.kind !== existing.kind) {
    throw new Error("紀錄類型與既有資料不一致");
  }

  const fields = parseEditableRecordFields(type, input);
  const unset: Record<string, ""> = {};
  for (const field of ["endedAt", "category", "value", "unit"] as const) {
    if (fields[field] === undefined) unset[field] = "";
  }

  await collection.updateOne(
    { _id: id },
    {
      $set: { ...fields, updatedAt: new Date() },
      ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}),
    },
  );
  const updated = await collection.findOne({ _id: id });
  return updated ? serializeBabyRecord(updated) : null;
}

export async function listBabyRecordsByDate(dateInput: unknown): Promise<BabyRecordView[]> {
  const date = parseDate(dateInput);
  const start = taipeiDate(date, "00:00");
  const end = new Date(start.getTime() + 86_400_000);
  const documents = await (await getBabyRecordsCollection())
    .find({ startedAt: { $gte: start, $lt: end } })
    .sort({ startedAt: -1, _id: -1 })
    .toArray();
  return documents.map(serializeBabyRecord);
}

export async function countBabyRecordsByType(
  recordTypeId: ObjectId,
): Promise<number> {
  return (await getBabyRecordsCollection()).countDocuments({ recordTypeId });
}

export async function finishRangeRecord(id: ObjectId, endTimeInput: unknown): Promise<BabyRecordView | null> {
  const collection = await getBabyRecordsCollection();
  const existing = await collection.findOne({ _id: id });
  if (!existing) return null;
  if (existing.kind !== "sleep" && existing.kind !== "customRange") {
    throw new Error("只有睡眠或區間紀錄可以設定結束時間");
  }
  const endTime = parseTime(endTimeInput, "結束時間");
  const taipeiStart = new Date(existing.startedAt.getTime() + 8 * 60 * 60 * 1000);
  const date = taipeiStart.toISOString().slice(0, 10);
  let endedAt = taipeiDate(date, endTime);
  if (endedAt <= existing.startedAt) endedAt = new Date(endedAt.getTime() + 86_400_000);

  await collection.updateOne(
    { _id: id },
    { $set: { endedAt, updatedAt: new Date() } },
  );
  const updated = await collection.findOne({ _id: id });
  return updated ? serializeBabyRecord(updated) : null;
}

export async function deleteBabyRecord(id: ObjectId): Promise<{ deletedCount: number; record: BabyRecordView | null }> {
  const collection = await getBabyRecordsCollection();
  const existing = await collection.findOne({ _id: id });
  if (!existing) return { deletedCount: 0, record: null };
  const result = await collection.deleteOne({ _id: id });
  return { deletedCount: result.deletedCount, record: serializeBabyRecord(existing) };
}
