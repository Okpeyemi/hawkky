import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { forUser } from "@/src/server/for-user";
import { getTestPrisma, isTestDbConfigured, resetDb } from "../setup/prisma-test";

describe.skipIf(!isTestDbConfigured)("multi-tenant isolation via forUser()", () => {
  beforeAll(async () => {
    await resetDb();
  });

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await getTestPrisma().$disconnect();
  });

  it("prevents user A from reading user B's profile", async () => {
    const testPrisma = getTestPrisma();
    const a = await testPrisma.user.create({
      data: { email: "a@test.local", profile: { create: {} } },
    });
    const b = await testPrisma.user.create({
      data: { email: "b@test.local", profile: { create: { interests: ["secret"] } } },
    });

    const scoped = forUser(testPrisma.profile, a.id);
    const found = await scoped.findFirst({ where: { userId: b.id } });
    expect(found).toBeNull();
  });

  it("prevents user A from updating user B's profile", async () => {
    const testPrisma = getTestPrisma();
    await testPrisma.user.create({
      data: { email: "a2@test.local", profile: { create: {} } },
    });
    const b = await testPrisma.user.create({
      data: { email: "b2@test.local", profile: { create: { interests: ["initial"] } } },
    });

    const a = await testPrisma.user.findUniqueOrThrow({ where: { email: "a2@test.local" } });
    const scoped = forUser(testPrisma.profile, a.id);
    const result = await scoped.updateMany({
      where: { userId: b.id },
      data: { interests: ["hijacked"] },
    });
    expect(result.count).toBe(0);

    const bProfile = await testPrisma.profile.findUnique({ where: { userId: b.id } });
    expect(bProfile?.interests).toEqual(["initial"]);
  });
});
