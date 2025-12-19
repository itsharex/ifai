export enum AccessTier {
  Public = 'public',
  Protected = 'protected',
  Private = 'private',
}

export interface PromptMetadata {
  name: string;
  description: string;
  version: string;
  author?: string;
  access_tier: AccessTier;
  variables: string[];
  tools: string[];
}

export interface PromptTemplate {
  metadata: PromptMetadata;
  content: string;
  raw_text: string;
  path?: string;
}
