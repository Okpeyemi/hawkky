import type { InngestFunction } from "inngest";
import { ingestSource } from "./ingest-source";

export const inngestFunctions: InngestFunction.Any[] = [ingestSource];
