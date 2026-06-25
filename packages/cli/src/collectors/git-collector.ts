import { execSync } from 'child_process';

export interface GitData {
  diff: string;
  commitMessages: string[];
}

export class GitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GitError';
  }
}

export function gitCollector(): GitData {
  // Check if we are inside a git repo first
  try {
    execSync('git rev-parse --is-inside-work-tree', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch {
    throw new GitError(
      'Not a git repository. Run devrelay handoff from inside a git project.'
    );
  }

  // Check if there is at least one commit
  try {
    execSync('git rev-parse HEAD', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch {
    throw new GitError(
      'No commits found. Make at least one commit before running devrelay handoff.'
    );
  }

  let diff = '';
  let commitMessages: string[] = [];

  try {
    diff = execSync('git diff HEAD~1 HEAD --unified=3', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch {
    // Only one commit exists — diff against empty tree
    diff = execSync('git diff --unified=3', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  }

  try {
    const log = execSync('git log --oneline --since="24 hours ago"', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    commitMessages = log
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
  } catch {
    commitMessages = [];
  }

  return { diff, commitMessages };
}
