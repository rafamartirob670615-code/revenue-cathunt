import { PostgresDatabase } from "../../application/postgres-database.ts";
import { PostgresStorageBucket } from "../../application/postgres-storage.ts";

const revenueDatabase = new PostgresDatabase();
const revenueFiles = new PostgresStorageBucket(revenueDatabase);

export function database() {
  return revenueDatabase;
}

export function files() {
  return revenueFiles;
}
