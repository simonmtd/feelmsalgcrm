import "server-only";
import type { DemoStore } from "@/lib/demo/store";

type Row = Record<string, unknown>;
type TableName = keyof Omit<DemoStore, "credentials">;

/**
 * Many-to-one relations this app embeds via Postgrest's `alias:table(...)`
 * select syntax (e.g. `niche:niches(*)`). Keyed by the source table, then
 * by the alias used in the select string.
 */
const EMBEDS: Record<string, Record<string, { table: TableName; fk: string }>> = {
  leads: { niche: { table: "niches", fk: "niche_id" } },
  profiles: { active_niche: { table: "niches", fk: "active_niche_id" } },
  lead_activities: { seller: { table: "profiles", fk: "seller_id" } },
  meetings: { seller: { table: "profiles", fk: "seller_id" }, lead: { table: "leads", fk: "lead_id" } },
};

function parseEmbeds(selectStr: string) {
  const embeds: { alias: string }[] = [];
  const re = /(\w+):\w+\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(selectStr))) embeds.push({ alias: m[1] });
  return embeds;
}

function resolveEmbeds(table: TableName, row: Row, embeds: { alias: string }[], store: DemoStore): Row {
  if (!embeds.length) return { ...row };
  const out = { ...row };
  for (const { alias } of embeds) {
    const def = EMBEDS[table]?.[alias];
    if (!def) continue;
    const fkVal = row[def.fk];
    const target = (store[def.table] as unknown as Row[]).find((r) => r.id === fkVal) ?? null;
    out[alias] = target;
  }
  return out;
}

function defaultsFor(table: TableName): Row {
  switch (table) {
    case "leads":
      return {
        status: "new",
        filming_status: "not_started",
        source: "manual",
        niche_id: null,
        assigned_to: null,
        assigned_date: null,
        next_follow_up_at: null,
        follow_up_reminded_at: null,
        deal_size: null,
        website: null,
        industry: null,
        job_title: null,
        hubspot_contact_id: null,
        raw_hubspot_data: null,
        company_name: null,
        contact_name: null,
        email: null,
        phone: null,
      };
    case "sync_runs":
      return { finished_at: null, records_synced: 0, error: null };
    case "meetings":
      return {
        lead_id: null,
        location: null,
        notes: null,
        type: "sales_meeting",
        deal_size: null,
        product_type: null,
      };
    case "notifications":
      return { read_at: null, lead_id: null, type: "lead_assigned" };
    case "audit_log":
      return { target_type: null, target_id: null, details: null };
    default:
      return {};
  }
}

type Mutation =
  | { type: "update"; payload: Row }
  | { type: "insert"; payload: Row }
  | { type: "upsert"; payload: Row | Row[]; onConflict?: string }
  | { type: "delete" };

/**
 * Minimal Postgrest-compatible query builder over an in-memory table.
 * Implements only the operators this codebase actually calls
 * (select/eq/is/in/not/order/limit/single/maybeSingle/update/insert/upsert)
 * — not a general Supabase re-implementation.
 */
export class MockQueryBuilder implements PromiseLike<{ data: unknown; error: null; count: number | null }> {
  private filters: ((row: Row) => boolean)[] = [];
  private selectStr = "*";
  private countExact = false;
  private headOnly = false;
  private orderCol?: string;
  private orderAsc = true;
  private limitN?: number;
  private wantSingle: "single" | "maybeSingle" | null = null;
  private mutation: Mutation | null = null;

  constructor(private table: TableName, private store: DemoStore) {}

  select(str = "*", opts?: { count?: "exact"; head?: boolean }) {
    this.selectStr = str;
    if (opts?.count === "exact") this.countExact = true;
    if (opts?.head) this.headOnly = true;
    return this;
  }

  eq(col: string, val: unknown) {
    this.filters.push((r) => r[col] === val);
    return this;
  }

  is(col: string, val: unknown) {
    this.filters.push((r) => r[col] === val);
    return this;
  }

  in(col: string, vals: unknown[]) {
    this.filters.push((r) => vals.includes(r[col]));
    return this;
  }

  lte(col: string, val: unknown) {
    this.filters.push((r) => r[col] != null && (r[col] as string | number) <= (val as string | number));
    return this;
  }

  gte(col: string, val: unknown) {
    this.filters.push((r) => r[col] != null && (r[col] as string | number) >= (val as string | number));
    return this;
  }

  not(col: string, op: string, val: unknown) {
    if (op === "is") {
      this.filters.push((r) => r[col] !== val);
    } else if (op === "in") {
      const vals = String(val)
        .replace(/[()]/g, "")
        .split(",")
        .map((s) => s.replace(/"/g, "").trim());
      this.filters.push((r) => !vals.includes(r[col] as string));
    }
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }) {
    this.orderCol = col;
    this.orderAsc = opts?.ascending ?? true;
    return this;
  }

  limit(n: number) {
    this.limitN = n;
    return this;
  }

  single() {
    this.wantSingle = "single";
    return this;
  }

  maybeSingle() {
    this.wantSingle = "maybeSingle";
    return this;
  }

  update(payload: Row) {
    this.mutation = { type: "update", payload };
    return this;
  }

  insert(payload: Row) {
    this.mutation = { type: "insert", payload };
    return this;
  }

  upsert(payload: Row, opts?: { onConflict?: string }) {
    this.mutation = { type: "upsert", payload, onConflict: opts?.onConflict };
    return this;
  }

  delete() {
    this.mutation = { type: "delete" };
    return this;
  }

  private matchAll(rows: Row[]) {
    return rows.filter((r) => this.filters.every((f) => f(r)));
  }

  private finalizeRows(rows: Row[]) {
    const embeds = parseEmbeds(this.selectStr);
    return rows.map((r) => resolveEmbeds(this.table, r, embeds, this.store));
  }

  private execute() {
    const table = this.store[this.table] as unknown as Row[];

    if (this.mutation?.type === "update") {
      const matched = this.matchAll(table);
      for (const row of matched) {
        Object.assign(row, this.mutation.payload);
        if ("updated_at" in row) row.updated_at = new Date().toISOString();
      }
      const rows = this.finalizeRows(matched);
      return { data: this.wantSingle ? rows[0] ?? null : rows, error: null, count: rows.length };
    }

    if (this.mutation?.type === "delete") {
      const matched = this.matchAll(table);
      const removed = this.finalizeRows(matched);
      for (const row of matched) {
        const index = table.indexOf(row);
        if (index !== -1) table.splice(index, 1);
      }
      return { data: removed, error: null, count: removed.length };
    }

    if (this.mutation?.type === "insert") {
      const now = new Date().toISOString();
      const newRow: Row = {
        id: crypto.randomUUID(),
        created_at: now,
        updated_at: now,
        ...defaultsFor(this.table),
        ...this.mutation.payload,
      };
      table.push(newRow);
      const rows = this.finalizeRows([newRow]);
      return { data: this.wantSingle ? rows[0] ?? null : rows, error: null, count: rows.length };
    }

    if (this.mutation?.type === "upsert") {
      const { payload, onConflict = "id" } = this.mutation;
      const items = Array.isArray(payload) ? payload : [payload];
      const resultRows: Row[] = [];
      for (const item of items) {
        const existing = table.find((r) => r[onConflict] === item[onConflict]);
        if (existing) {
          Object.assign(existing, item);
          if ("updated_at" in existing) existing.updated_at = new Date().toISOString();
          resultRows.push(existing);
        } else {
          const now = new Date().toISOString();
          const row: Row = {
            id: crypto.randomUUID(),
            created_at: now,
            updated_at: now,
            ...defaultsFor(this.table),
            ...item,
          };
          table.push(row);
          resultRows.push(row);
        }
      }
      const rows = this.finalizeRows(resultRows);
      return { data: this.wantSingle ? rows[0] ?? null : rows, error: null, count: rows.length };
    }

    // plain select
    let rows = this.matchAll(table);
    if (this.orderCol) {
      const col = this.orderCol;
      rows = [...rows].sort((a, b) => {
        const av = a[col] as string | number;
        const bv = b[col] as string | number;
        if (av === bv) return 0;
        const cmp = av < bv ? -1 : 1;
        return this.orderAsc ? cmp : -cmp;
      });
    }
    const count = rows.length;
    if (this.limitN != null) rows = rows.slice(0, this.limitN);

    if (this.headOnly) {
      return { data: null, error: null, count: this.countExact ? count : null };
    }

    const finalized = this.finalizeRows(rows);

    if (this.wantSingle) {
      return { data: finalized[0] ?? null, error: null, count };
    }
    return { data: finalized, error: null, count: this.countExact ? count : null };
  }

  then<TResult1 = { data: unknown; error: null; count: number | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: null; count: number | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }
}
