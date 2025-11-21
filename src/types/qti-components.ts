export type { ItemContext } from "@citolab/qti-components";
export type { TestContext } from "@citolab/qti-components";

export interface ResponseInteraction {
  responseIdentifier: string;
  value: string | string[] | null;
  sessionIds?: string[];
  [key: string]: unknown;
}
