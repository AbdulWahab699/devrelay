import { z } from 'zod';

export const FilteredCommandSchema = z.object({
  cmd: z.string(),
  signalScore: z.number(),
  exit_codes_unavailable: z.boolean().optional(),
});

export const FilteredPayloadSchema = z.object({
  gitSummary: z.string(),
  terminalCommands: z.array(FilteredCommandSchema),
  slackSummary: z.string(),
});

export const HandoffBriefSchema = z.object({
  what_changed: z.string(),
  what_failed: z.string(),
  decisions_made: z.string(),
  next_steps: z.string(),
  confidence: z.enum(['high', 'medium', 'low']),
});

export type FilteredPayloadInput = z.infer<typeof FilteredPayloadSchema>;
export type HandoffBriefInput = z.infer<typeof HandoffBriefSchema>;
