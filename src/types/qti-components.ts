export type { ItemContext } from "@citolab/qti-components/exports/item.context.js";
export type { TestContext } from "@citolab/qti-components/exports/test.context.js";

export interface ResponseInteraction {
  responseIdentifier: string;
  value: string | string[] | null;
  sessionIds?: string[];
  [key: string]: unknown;
}

