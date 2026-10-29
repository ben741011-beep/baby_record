import { Db, MongoClient } from "mongodb";

declare global {
  var mongoClientPromise: Promise<MongoClient> | undefined;
}

let clientPromise: Promise<MongoClient> | undefined;

function getMongoClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("Missing MONGODB_URI environment variable");
  }

  if (global.mongoClientPromise) return global.mongoClientPromise;

  clientPromise ??= new MongoClient(uri, {
    serverSelectionTimeoutMS: 10_000,
  }).connect();

  if (process.env.NODE_ENV !== "production") {
    global.mongoClientPromise = clientPromise;
  }

  return clientPromise;
}

export async function getDatabase(): Promise<Db> {
  const client = await getMongoClient();
  return client.db();
}
