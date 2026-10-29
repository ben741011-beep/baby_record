import { randomUUID } from "node:crypto";
import { ObjectId, type Collection, type Document, type IndexDescription } from "mongodb";
import { getDatabase } from "@/lib/mongodb";

export const RECORD_TYPES_COLLECTION = "recordTypes";

export const RECORD_KINDS = [
  "milk",
  "sleep",
  "diaper",
  "pump",
  "temperature",
  "customTime",
  "customRange",
  "customInteger",
  "customDecimal",
] as const;

export type RecordKind = (typeof RECORD_KINDS)[number];
export type CustomRecordKind = Extract<RecordKind, `custom${string}`>;

export interface RecordTypeDocument {
  _id: ObjectId;
  key: string;
  label: string;
  icon: string;
  kind: RecordKind;
  builtIn: boolean;
  isVisible: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}
export interface RecordTypeView {
  id: string;
  key: string;
  label: string;
  icon: string;
  kind: RecordKind;
  builtIn: boolean;
  isVisible: boolean;
  sortOrder: number;
}
export const RECORD_TYPE_VALIDATOR: Document = {
  $jsonSchema: {
    bsonType: "object",
    additionalProperties: false,
    required: [
      "_id",
      "key",
      "label",
      "icon",
      "kind",
      "builtIn",
      "isVisible",
      "sortOrder",
      "createdAt",
      "updatedAt",
    ],
    properties: {
      _id: { bsonType: "objectId" },
      key: { bsonType: "string", minLength: 1, maxLength: 80 },
      label: { bsonType: "string", minLength: 1, maxLength: 20 },
      icon: { bsonType: "string", minLength: 1, maxLength: 16 },
      kind: { bsonType: "string", enum: [...RECORD_KINDS] },
      builtIn: { bsonType: "bool" },
      isVisible: { bsonType: "bool" },
      sortOrder: { bsonType: "int", minimum: 0 },
      createdAt: { bsonType: "date" },
      updatedAt: { bsonType: "date" },
    },
  },
};

export const RECORD_TYPE_INDEXES: IndexDescription[] = [
  { key: { key: 1 }, name: "key_1", unique: true },
  { key: { isVisible: 1, sortOrder: 1 }, name: "isVisible_1_sortOrder_1" },
];

export const BUILTIN_RECORD_TYPES = [
  { key: "milk", label: "喝奶", icon: "🍼", kind: "milk", sortOrder: 10 },
  { key: "sleep", label: "睡覺", icon: "☁️", kind: "sleep", sortOrder: 20 },
  { key: "diaper", label: "尿布", icon: "🧷", kind: "diaper", sortOrder: 30 },
  { key: "pump", label: "擠奶", icon: "🤱", kind: "pump", sortOrder: 40 },
  {
    key: "temperature",
    label: "體溫",
    icon: "🌡️",
    kind: "temperature",
    sortOrder: 50,
  },
] as const;

export async function getRecordTypesCollection(): Promise<
  Collection<RecordTypeDocument>
> {
  return (await getDatabase()).collection<RecordTypeDocument>(
    RECORD_TYPES_COLLECTION,
  );
}
export function serializeRecordType(document: RecordTypeDocument): RecordTypeView {
  return {
    id: document._id.toHexString(),
    key: document.key,
    label: document.label,
    icon: document.icon,
    kind: document.kind,
    builtIn: document.builtIn,
    isVisible: document.isVisible,
    sortOrder: document.sortOrder,
  };
}
export async function listRecordTypes(): Promise<RecordTypeView[]> {
  const documents = await (await getRecordTypesCollection())
    .find({})
    .sort({ sortOrder: 1, _id: 1 })
    .toArray();
  return documents.map(serializeRecordType);
}
function parseLabel(value: unknown): string {
  if (typeof value !== "string") throw new Error("項目名稱必須是文字");
  const label = value.trim();
  if (!label || label.length > 20) throw new Error("項目名稱需為 1–20 個字");
  return label;
}
function parseIcon(value: unknown): string {
  if (typeof value !== "string") throw new Error("請選擇圖示");
  const icon = value.trim();
  if (!icon || icon.length > 16) throw new Error("圖示格式不正確");
  return icon;
}

function parseCustomKind(value: unknown): CustomRecordKind {
  const allowed: CustomRecordKind[] = [
    "customTime",
    "customRange",
    "customInteger",
    "customDecimal",
  ];
  if (!allowed.includes(value as CustomRecordKind)) throw new Error("欄位模板不正確");
  return value as CustomRecordKind;
}

export async function createCustomRecordType(input: {
  label?: unknown;
  icon?: unknown;
  kind?: unknown;
}): Promise<RecordTypeView> {
  const collection = await getRecordTypesCollection();
  const last = await collection.find({}).sort({ sortOrder: -1 }).limit(1).next();
  const now = new Date();
  const document = {
    _id: new ObjectId(),
    key: `custom_${randomUUID()}`,
    label: parseLabel(input.label),
    icon: parseIcon(input.icon),
    kind: parseCustomKind(input.kind),
    builtIn: false,
    isVisible: true,
    sortOrder: (last?.sortOrder ?? 50) + 10,
    createdAt: now,
    updatedAt: now,
  };
  const result = await collection.insertOne(document);
  const inserted = await collection.findOne({ _id: result.insertedId });
  if (!inserted) throw new Error("自訂項目新增後無法讀回");
  return serializeRecordType(inserted);
}

export async function setRecordTypeVisibility(
  id: ObjectId,
  isVisible: boolean,
): Promise<RecordTypeView | null> {
  const collection = await getRecordTypesCollection();
  const existing = await collection.findOne({ _id: id });
  if (!existing) return null;
  await collection.updateOne({ _id: id }, { $set: { isVisible, updatedAt: new Date() } });
  const updated = await collection.findOne({ _id: id });
  return updated ? serializeRecordType(updated) : null;
}

export async function deleteCustomRecordType(
  id: ObjectId,
): Promise<{ deletedCount: number; recordType: RecordTypeView | null }> {
  const collection = await getRecordTypesCollection();
  const existing = await collection.findOne({ _id: id });
  if (!existing) return { deletedCount: 0, recordType: null };
  if (existing.builtIn) throw new Error("內建記錄項目不可刪除");

  const result = await collection.deleteOne({ _id: id, builtIn: false });
  return {
    deletedCount: result.deletedCount,
    recordType: serializeRecordType(existing),
  };
}
