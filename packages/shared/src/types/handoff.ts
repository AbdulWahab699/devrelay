export type HandoffStatus = 'draft' | 'awaiting_review' | 'published';
export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface HandoffBrief {
  what_changed: string;
  what_failed: string;
  decisions_made: string;
  next_steps: string;
  confidence: ConfidenceLevel;
}

export interface FilteredCommand {
  cmd: string;
  signalScore: number;
  exit_codes_unavailable?: boolean;
}

export interface FilteredPayload {
  gitSummary: string;
  terminalCommands: FilteredCommand[];
  slackSummary: string;
}
