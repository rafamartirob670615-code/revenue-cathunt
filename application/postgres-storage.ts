import type { PostgresDatabase } from "./postgres-database.ts";

type StoredObject = {
  text(): Promise<string>;
};

type PutOptions = {
  httpMetadata?: { contentType?: string };
};

export class PostgresStorageBucket {
  constructor(private readonly database: PostgresDatabase) {}

  async get(key: string): Promise<StoredObject | null> {
    const row = await this.database
      .prepare("SELECT body FROM file_objects WHERE object_key = ?")
      .bind(key)
      .first<{ body: Uint8Array }>();
    if (!row) return null;
    const bytes = row.body;
    return {
      async text() {
        return new TextDecoder().decode(bytes);
      },
    };
  }

  async put(key: string, value: ArrayBuffer, options?: PutOptions): Promise<void> {
    await this.database
      .prepare(`
        INSERT INTO file_objects (object_key, body, content_type, size_bytes, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT (object_key) DO UPDATE SET
          body = excluded.body,
          content_type = excluded.content_type,
          size_bytes = excluded.size_bytes,
          updated_at = excluded.updated_at
      `)
      .bind(
        key,
        new Uint8Array(value),
        options?.httpMetadata?.contentType ?? "application/octet-stream",
        value.byteLength,
        new Date().toISOString(),
      )
      .run();
  }
}
