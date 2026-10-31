import type { Draft, Stage } from './types';
export function generatedIdsForTarget(draft: Draft | null, targetId: string): string[];
export function prepareRegeneration(draft: Draft, targetId: string): Stage;
