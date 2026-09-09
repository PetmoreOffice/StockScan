import sql from "mssql";
import type { Branch, Product } from "@/lib/types";

let poolPromise: Promise<sql.ConnectionPool> | null = null;

function getConfig(): sql.config {
  const required = ["SQL_SERVER", "SQL_DATABASE", "SQL_USER", "SQL_PASSWORD"] as const;
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing environment variable: ${key}`);
    }
  }

  return {
    server: process.env.SQL_SERVER!,
    port: Number(process.env.SQL_PORT ?? 1433),
    database: process.env.SQL_DATABASE!,
    user: process.env.SQL_USER!,
    password: process.env.SQL_PASSWORD!,
    options: {
      encrypt: process.env.SQL_ENCRYPT === "true",
      trustServerCertificate: process.env.SQL_TRUST_SERVER_CERTIFICATE !== "false",
    },
    pool: { max: 5, min: 0, idleTimeoutMillis: 30_000 },
  };
}

async function getPool() {
  if (!poolPromise) {
    poolPromise = sql.connect(getConfig()).catch((error) => {
      poolPromise = null;
      throw error;
    });
  }
  return poolPromise;
}

export async function listBranches(): Promise<Branch[]> {
  const pool = await getPool();
  // Read-only by design: this module contains SELECT queries only.
  const result = await pool.request().query<{
    BR_KEY: string | number;
    BR_THAIDESC: string;
  }>(`
    SELECT BR_KEY, BR_THAIDESC
    FROM dbo.BRANCH
    ORDER BY BR_KEY
  `);

  return result.recordset.map((row) => ({
    key: String(row.BR_KEY),
    name: row.BR_THAIDESC,
  }));
}

export async function findProductByBarcode(barcode: string): Promise<Product | null> {
  const pool = await getPool();
  // Read-only by design: this module contains SELECT queries only.
  const result = await pool
    .request()
    .input("scanValue", sql.VarChar(120), barcode)
    .query<{
      GOODS_KEY: string | number;
      GOODS_CODE: string;
      SKU_KEY: string | number;
      SKU_CODE: string;
      SKU_NAME: string;
      UTQ_KEY: string | number;
      UTQ_NAME: string;
    }>(`
      SELECT TOP (1)
        G.GOODS_KEY,
        G.GOODS_CODE,
        S.SKU_KEY,
        S.SKU_CODE,
        S.SKU_NAME,
        U.UTQ_KEY,
        U.UTQ_NAME
      FROM dbo.GOODSMASTER AS G
      INNER JOIN dbo.SKUMASTER AS S ON G.GOODS_SKU = S.SKU_KEY
      INNER JOIN dbo.UOFQTY AS U ON G.GOODS_UTQ = U.UTQ_KEY
      WHERE LTRIM(RTRIM(G.GOODS_CODE)) = @scanValue
         OR LTRIM(RTRIM(S.SKU_BARCODE)) = @scanValue
      ORDER BY
        CASE WHEN LTRIM(RTRIM(G.GOODS_CODE)) = @scanValue THEN 0 ELSE 1 END,
        U.UTQ_QTY ASC,
        G.GOODS_KEY ASC
    `);

  const row = result.recordset[0];
  if (!row) return null;

  return {
    goodsKey: String(row.GOODS_KEY),
    barcode: String(row.GOODS_CODE),
    skuKey: String(row.SKU_KEY),
    skuCode: String(row.SKU_CODE),
    skuName: row.SKU_NAME,
    unitKey: String(row.UTQ_KEY),
    unitName: row.UTQ_NAME,
  };
}
