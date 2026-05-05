type AnyArgs = Record<string, unknown>;

const SCOPED_BY_WHERE = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findUnique",
  "findUniqueOrThrow",
  "findMany",
  "update",
  "updateMany",
  "delete",
  "deleteMany",
  "count",
  "aggregate",
]);

/**
 * Wraps a Prisma model delegate so every read/write is implicitly scoped to a userId.
 *
 * Application code MUST go through this guard for any user-owned model — never
 * reach into `prisma.briefing` directly with an id-only `where`, otherwise it
 * can read or mutate another tenant's row.
 *
 * Scoping rules per Prisma method:
 *   - findFirst/findUnique/findMany/update/delete/count/aggregate → inject userId in `where`
 *   - create                                                      → inject userId in `data`
 *   - createMany                                                  → inject userId in every row of `data`
 *   - upsert                                                      → inject userId in `where`, `create`, and `update`
 *
 * In all cases the injected userId overrides any user-supplied value, so a
 * malicious payload cannot impersonate another tenant.
 */
export function forUser<T extends object>(delegate: T, userId: string): T {
  return new Proxy(delegate, {
    get(target, prop: string, receiver) {
      const orig = Reflect.get(target, prop, receiver);
      if (typeof orig !== "function") return orig;
      const fn = orig as (args?: AnyArgs) => unknown;

      if (SCOPED_BY_WHERE.has(prop)) {
        return (args: AnyArgs = {}) => {
          const where = { ...((args.where as AnyArgs | undefined) ?? {}), userId };
          return fn.call(target, { ...args, where });
        };
      }

      if (prop === "create") {
        return (args: AnyArgs = {}) => {
          const data = { ...((args.data as AnyArgs | undefined) ?? {}), userId };
          return fn.call(target, { ...args, data });
        };
      }

      if (prop === "createMany") {
        return (args: AnyArgs = {}) => {
          const rows = (args.data as AnyArgs[] | undefined) ?? [];
          const data = rows.map((row) => ({ ...row, userId }));
          return fn.call(target, { ...args, data });
        };
      }

      if (prop === "upsert") {
        return (args: AnyArgs = {}) => {
          const where = { ...((args.where as AnyArgs | undefined) ?? {}), userId };
          const create = { ...((args.create as AnyArgs | undefined) ?? {}), userId };
          const update = { ...((args.update as AnyArgs | undefined) ?? {}), userId };
          return fn.call(target, { ...args, where, create, update });
        };
      }

      return fn.bind(target);
    },
  }) as T;
}
