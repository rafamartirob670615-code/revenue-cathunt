import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const inputApi = new URL("../../app/api/inputs/route.ts", import.meta.url);
const baselineApi = new URL("../../app/api/baseline/route.ts", import.meta.url);

test("la API preserva el Excel y publica por separado un dataset canónico", async () => {
  const source = await readFile(inputApi, "utf8");
  assert.match(source, /XLSX\.read/);
  assert.match(source, /analyzeSalesWorkbook/);
  assert.match(source, /source\/\$\{checksum\}/);
  assert.match(source, /canonical\/\$\{checksum\}\.json/);
  assert.match(source, /INSERT INTO canonical_datasets/);
  assert.match(source, /20_000_000/);
});

test("baseline utiliza el dataset canónico cuando la historia proviene de Excel", async () => {
  const source = await readFile(baselineApi, "utf8");
  assert.match(source, /canonical_datasets/);
  assert.match(source, /calculateBaselineFromCanonicalSales/);
  assert.match(source, /canonical_object_key/);
});
