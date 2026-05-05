import { describe, expect, it, vi } from "vitest";
import { forUser } from "@/src/server/for-user";

describe("forUser() multi-tenancy guard", () => {
  it("forwards calls to the underlying delegate, injecting userId in where", async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: "b1", userId: "u1" });
    const update = vi.fn().mockResolvedValue({ id: "b1" });
    const delegate = { findFirst, update };

    const scoped = forUser(delegate, "u1");

    await scoped.findFirst({ where: { id: "b1" } });
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: "b1", userId: "u1" },
    });

    await scoped.update({ where: { id: "b1" }, data: { foo: 1 } });
    expect(update).toHaveBeenCalledWith({
      where: { id: "b1", userId: "u1" },
      data: { foo: 1 },
    });
  });

  it("forces userId in `data` for create() — overrides attacker-supplied value", async () => {
    const create = vi.fn().mockResolvedValue({ id: "x" });
    const scoped = forUser({ create }, "u1");
    await scoped.create({ data: { name: "n", userId: "ATTACKER" } });
    expect(create).toHaveBeenCalledWith({ data: { name: "n", userId: "u1" } });
  });

  it("scopes upsert: injects userId in where, create, and update (overrides attacker values)", async () => {
    const upsert = vi.fn().mockResolvedValue({ id: "x" });
    const scoped = forUser({ upsert }, "u1");

    await scoped.upsert({
      where: { id: "x", userId: "ATTACKER" },
      create: { id: "x", name: "n", userId: "ATTACKER" },
      update: { name: "n2", userId: "ATTACKER" },
    });

    expect(upsert).toHaveBeenCalledWith({
      where: { id: "x", userId: "u1" },
      create: { id: "x", name: "n", userId: "u1" },
      update: { name: "n2", userId: "u1" },
    });
  });

  it("scopes createMany: injects userId in every row of the data array", async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 2 });
    const scoped = forUser({ createMany }, "u1");

    await scoped.createMany({
      data: [{ name: "a", userId: "ATTACKER" }, { name: "b" }],
    });

    expect(createMany).toHaveBeenCalledWith({
      data: [
        { name: "a", userId: "u1" },
        { name: "b", userId: "u1" },
      ],
    });
  });

  it("returns null when the delegate finds no row (delegate's job, not ours)", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const scoped = forUser({ findFirst }, "u1");
    const r = await scoped.findFirst({ where: { id: "b1" } });
    expect(r).toBeNull();
  });
});
