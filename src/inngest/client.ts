import { eventType, Inngest, staticSchema } from "inngest";

/**
 * Typed event definitions for Hawkky.
 *
 * Note: `inngest` v4 dropped the `new EventSchemas().fromRecord<...>()`
 * pattern (v3-era API). The current idiom is `eventType()` paired with
 * `staticSchema()` for type-only validation. The event constants below can
 * be imported and used as triggers in `src/inngest/functions/*`.
 */
export const sourceIngestRequested = eventType("source.ingest.requested", {
  schema: staticSchema<{ sourceId: string }>(),
});

export const inngest = new Inngest({
  id: "hawkky",
});
