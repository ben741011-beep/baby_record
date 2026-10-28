import { Db, MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error("Missing MONGODB_URI in .env.local");
}
declare global {
  var mongoClientPromise: Promise<MongoClient> | undefined;
}
const clientPromise =
  global.mongoClientPromise ??
  new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 }).connect();

if (process.env.NODE_ENV !== "production") {
  global.mongoClientPromise = clientPromise;
}
export async function getDatabase(): Promise<Db> {
  const client = await clientPromise;
  return client.db();
}
