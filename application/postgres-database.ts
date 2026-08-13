import postgres from "postgres";
import type { SqlDatabaseLike } from "./sql-repository.ts";

type QueryResult<T> = {
  results?: T[];
  meta?: { changes?: number };
};

type SqlClient = ReturnType<typeof postgres>;
type TransactionClient = postgres.TransactionSql;

const globalDatabase = globalThis as typeof globalThis & {
  revenuePostgres?: SqlClient;
};

function connection(): SqlClient {
  const connectionString = process.env.SUPABASE_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Persistencia no disponible: falta SUPABASE_DATABASE_URL");
  }
  globalDatabase.revenuePostgres ??= postgres(connectionString, {
    max: 5,
    prepare: false,
    connect_timeout: 10,
    idle_timeout: 20,
  });
  return globalDatabase.revenuePostgres;
}

function postgresPlaceholders(source: string): string {
  let parameter = 0;
  let singleQuoted = false;
  let doubleQuoted = false;
  let result = "";
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === "'" && !doubleQuoted) {
      if (singleQuoted && source[index + 1] === "'") {
        result += "''";
        index += 1;
        continue;
      }
      singleQuoted = !singleQuoted;
    } else if (character === '"' && !singleQuoted) {
      doubleQuoted = !doubleQuoted;
    }
    if (character === "?" && !singleQuoted && !doubleQuoted) {
      parameter += 1;
      result += `$${parameter}`;
    } else {
      result += character;
    }
  }
  return result;
}

class PostgresStatement {
  readonly sql: string;
  values: unknown[] = [];

  constructor(
    private readonly database: PostgresDatabase,
    sql: string,
  ) {
    this.sql = sql;
  }

  bind(...values: unknown[]): PostgresStatement {
    this.values = values.map((value) => value === undefined ? null : value);
    return this;
  }

  async first<T>(): Promise<T | null> {
    const result = await this.database.execute<T>(this);
    return result.results?.[0] ?? null;
  }

  run<T>(): Promise<QueryResult<T>> {
    return this.database.execute<T>(this);
  }
}

export class PostgresDatabase implements SqlDatabaseLike {
  prepare(sql: string): PostgresStatement {
    return new PostgresStatement(this, sql);
  }

  async execute<T>(statement: PostgresStatement): Promise<QueryResult<T>> {
    return connection().begin(async (transaction) => {
      await transaction.unsafe("SET LOCAL search_path TO revenue, public");
      return this.executeInTransaction<T>(transaction, statement);
    });
  }

  async batch<T = unknown>(statements: PostgresStatement[]): Promise<QueryResult<T>[]> {
    return connection().begin(async (transaction) => {
      await transaction.unsafe("SET LOCAL search_path TO revenue, public");
      const results: QueryResult<T>[] = [];
      for (const statement of statements) {
        results.push(await this.executeInTransaction<T>(transaction, statement));
      }
      return results;
    });
  }

  private async executeInTransaction<T>(
    transaction: TransactionClient,
    statement: PostgresStatement,
  ): Promise<QueryResult<T>> {
    const rows = await transaction.unsafe(
      postgresPlaceholders(statement.sql),
      statement.values as never[],
    );
    return {
      results: Array.from(rows) as T[],
      meta: { changes: rows.count ?? rows.length },
    };
  }
}
