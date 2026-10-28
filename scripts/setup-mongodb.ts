import type { Db, Document, IndexDescription } from "mongodb";
import { getDatabase } from "../lib/mongodb";
import {
  BABY_PROFILES_COLLECTION,
  BABY_PROFILE_INDEXES,
  BABY_PROFILE_VALIDATOR,
} from "../models/BabyProfile";
import {
  BUILTIN_RECORD_TYPES,
  getRecordTypesCollection,
  RECORD_TYPES_COLLECTION,
  RECORD_TYPE_INDEXES,
  RECORD_TYPE_VALIDATOR,
} from "../models/RecordType";
import {
  BABY_RECORDS_COLLECTION,
  BABY_RECORD_INDEXES,
  BABY_RECORD_VALIDATOR,
} from "../models/BabyRecord";

const TARGETS: Array<{
  name: string;
  validator: Document;
  indexes: IndexDescription[];
}> = [
  {
    name: BABY_PROFILES_COLLECTION,
    validator: BABY_PROFILE_VALIDATOR,
    indexes: BABY_PROFILE_INDEXES,
  },
  {
    name: RECORD_TYPES_COLLECTION,
    validator: RECORD_TYPE_VALIDATOR,
    indexes: RECORD_TYPE_INDEXES,
  },
  {
    name: BABY_RECORDS_COLLECTION,
    validator: BABY_RECORD_VALIDATOR,
    indexes: BABY_RECORD_INDEXES,
  },
];

async function assertApprovedBaseline(database: Db) {
  const existing = await database.listCollections({}, { nameOnly: false }).toArray();
  const targetNames = new Set(TARGETS.map((target) => target.name));
  const existingTargets = existing.filter((item) => targetNames.has(item.name));
  if (existingTargets.length > 0) {
    throw new Error(
      `停止：核准快照要求目標 collections 尚不存在，但目前發現 ${existingTargets
        .map((item) => item.name)
        .join(", ")}`,
    );
  }

  const testDefinition = existing.find((item) => item.name === "test");
  if (!testDefinition) throw new Error("停止：核准快照中的 test collection 已不存在");
  const testCollection = database.collection("test");
  const [testCount, testIndexes] = await Promise.all([
    testCollection.countDocuments({}),
    testCollection.indexes(),
  ]);
  if (
    testCount !== 0 ||
    testDefinition.options?.validator ||
    testIndexes.length !== 1 ||
    testIndexes[0]?.name !== "_id_"
  ) {
    throw new Error("停止：test collection 已與核准快照不同");
  }
}

async function createSchema(database: Db) {
  for (const target of TARGETS) {
    await database.createCollection(target.name, {
      validator: target.validator,
      validationLevel: "strict",
      validationAction: "error",
    });
    if (target.indexes.length > 0) {
      await database.collection(target.name).createIndexes(target.indexes);
    }
  }
}

async function seedBuiltInTypes() {
  const collection = await getRecordTypesCollection();
  const now = new Date();
  const result = await collection.bulkWrite(
    BUILTIN_RECORD_TYPES.map((type) => ({
      updateOne: {
        filter: { key: type.key },
        update: {
          $setOnInsert: {
            ...type,
            builtIn: true,
            isVisible: true,
            createdAt: now,
            updatedAt: now,
          },
        },
        upsert: true,
      },
    })),
    { ordered: true },
  );

  const documents = await collection
    .find({ key: { $in: BUILTIN_RECORD_TYPES.map((type) => type.key) } })
    .sort({ sortOrder: 1 })
    .toArray();

  if (documents.length !== BUILTIN_RECORD_TYPES.length) {
    throw new Error("內建類型寫入後數量不符");
  }

  return {
    inserted: result.upsertedCount,
    modified: result.modifiedCount,
    matched: result.matchedCount,
    ids: documents.map((document) => ({
      id: document._id.toHexString(),
      key: document.key,
    })),
  };
}

async function verify(database: Db) {
  const definitions = await database.listCollections({}, { nameOnly: false }).toArray();
  const result = [];
  for (const target of TARGETS) {
    const definition = definitions.find((item) => item.name === target.name);
    if (!definition) throw new Error(`找不到 ${target.name}`);
    result.push({
      name: target.name,
      count: await database.collection(target.name).countDocuments({}),
      validationLevel: definition.options?.validationLevel,
      validationAction: definition.options?.validationAction,
      validator: definition.options?.validator,
      indexes: await database.collection(target.name).indexes(),
    });
  }
  return result;
}

async function main() {
  const database = await getDatabase();

  try {
    await assertApprovedBaseline(database);
    await createSchema(database);
    const seed = await seedBuiltInTypes();
    const schema = await verify(database);
    console.log(
      JSON.stringify({ database: database.databaseName, seed, schema }, null, 2),
    );
  } catch (error) {
    const definitions = await database
      .listCollections({}, { nameOnly: false })
      .toArray();
    const reconciliation = [];
    for (const definition of definitions.filter((item) =>
      TARGETS.some((target) => target.name === item.name),
    )) {
      reconciliation.push({
        name: definition.name,
        count: await database.collection(definition.name).countDocuments({}),
        indexes: await database.collection(definition.name).indexes(),
      });
    }
    console.error(
      JSON.stringify(
        {
          error: error instanceof Error ? error.message : String(error),
          reconciliation,
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  }
}

void main();
