import { ObjectId } from "mongodb";

export function parseObjectId(value: string): ObjectId {
  if (!ObjectId.isValid(value)) throw new Error("資料識別碼不正確");
  return new ObjectId(value);
}
