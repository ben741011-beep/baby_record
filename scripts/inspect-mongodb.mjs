import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error("MONGODB_URI is not configured.");
}

function bsonType(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (value instanceof Date) return "date";
  if (value?._bsontype) return value._bsontype;
  return typeof value;
}

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 });

try {
  await client.connect();
  const database = client.db();
  await database.command({ ping: 1 });

  const definitions = await database.listCollections({}, { nameOnly: false }).toArray();
  const collections = [];

  for (const definition of definitions) {
    const collection = database.collection(definition.name);
    const count = await collection.countDocuments({});
    const indexes = await collection.indexes();
    const sample = count > 0 ? await collection.findOne({}) : null;

    collections.push({
      name: definition.name,
      type: definition.type,
      count,
      validator: definition.options?.validator ?? null,
      validationLevel: definition.options?.validationLevel ?? null,
      validationAction: definition.options?.validationAction ?? null,
      indexes,
      sampleShape: sample
        ? Object.fromEntries(Object.entries(sample).map(([key, value]) => [key, bsonType(value)]))
        : null,
    });
  }

  console.log(JSON.stringify({ database: database.databaseName, collections }, null, 2));
} finally {
  await client.close();
}
