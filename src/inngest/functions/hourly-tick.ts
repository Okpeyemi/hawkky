import { inngest } from "@/src/inngest/client";
import { findStaleSourceIds } from "@/src/server/sources-service";

export const hourlyTick = inngest.createFunction(
  {
    id: "hourly-tick",
    triggers: [{ cron: "*/15 * * * *" }],
  },
  async ({ step }) => {
    const ids = await step.run("find-stale", () => findStaleSourceIds());
    if (ids.length === 0) return { fanned: 0 };
    await step.sendEvent(
      "fan-out-ingest",
      ids.map((sourceId) => ({
        name: "source.ingest.requested" as const,
        data: { sourceId },
      })),
    );
    return { fanned: ids.length };
  },
);
