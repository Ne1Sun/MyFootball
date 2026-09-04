declare module "cloudflare:workers" {
  export const env: {
    DB: D1Database;
    ASSETS?: Fetcher;
    IMAGES?: unknown;
  };
}

interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run<T = unknown>(): Promise<{ success: boolean; results?: T[]; meta: Record<string, unknown> }>;
  all<T = unknown>(): Promise<{ success: boolean; results: T[]; meta: Record<string, unknown> }>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  dump(): Promise<ArrayBuffer>;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<Array<{ success: boolean; results: T[] }>>;
  exec(query: string): Promise<{ count: number; duration: number }>;
}
