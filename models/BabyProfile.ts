import type { Collection, Document, IndexDescription, ObjectId } from "mongodb";
import { getDatabase } from "@/lib/mongodb";

export const BABY_PROFILES_COLLECTION = "babyProfiles";

export interface BabyProfileDocument {
  _id: ObjectId;
  profileKey: "default";
  name: string;
  createdAt: Date;
  updatedAt: Date;
}
export interface BabyProfileView {
  id: string;
  name: string;
}
export const BABY_PROFILE_VALIDATOR: Document = {
  $jsonSchema: {
    bsonType: "object",
    additionalProperties: false,
    required: ["_id", "profileKey", "name", "createdAt", "updatedAt"],
    properties: {
      _id: { bsonType: "objectId" },
      profileKey: { bsonType: "string", enum: ["default"] },
      name: { bsonType: "string", minLength: 1, maxLength: 30 },
      createdAt: { bsonType: "date" },
      updatedAt: { bsonType: "date" },
    },
  },
};

export const BABY_PROFILE_INDEXES: IndexDescription[] = [
  { key: { profileKey: 1 }, name: "profileKey_1", unique: true },
];

export async function getBabyProfilesCollection(): Promise<
  Collection<BabyProfileDocument>
> {
  return (await getDatabase()).collection<BabyProfileDocument>(
    BABY_PROFILES_COLLECTION,
  );
}
export function parseBabyName(value: unknown): string {
  if (typeof value !== "string") throw new Error("寶寶名稱必須是文字");
  const name = value.trim();
  if (!name || name.length > 30) throw new Error("寶寶名稱需為 1–30 個字");
  return name;
}
export function serializeBabyProfile(
  document: BabyProfileDocument | null,
): BabyProfileView | null {
  return document ? { id: document._id.toHexString(), name: document.name } : null;
}
export async function getBabyProfile(): Promise<BabyProfileView | null> {
  const document = await (await getBabyProfilesCollection()).findOne({
    profileKey: "default",
  });
  return serializeBabyProfile(document);
}
export async function saveBabyProfileName(nameInput: unknown): Promise<BabyProfileView> {
  const name = parseBabyName(nameInput);
  const collection = await getBabyProfilesCollection();
  const now = new Date();

  await collection.updateOne(
    { profileKey: "default" },
    {
      $set: { name, updatedAt: now },
      $setOnInsert: { profileKey: "default", createdAt: now },
    },
    { upsert: true },
  );

  const document = await collection.findOne({ profileKey: "default" });
  if (!document) throw new Error("寶寶名稱儲存後無法讀回");
  return serializeBabyProfile(document)!;
}
