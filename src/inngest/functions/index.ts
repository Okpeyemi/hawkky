import type { InngestFunction } from "inngest";
import { hourlyTick } from "./hourly-tick";
import { ingestSource } from "./ingest-source";

export const inngestFunctions: InngestFunction.Any[] = [hourlyTick, ingestSource];
