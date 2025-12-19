export interface ConversationSummary {
  primaryRequest: string;
  keyTechnicalConcepts: string[];
  fileChanges: Array<{
    filePath: string;
    summary: string;
    codeSnippet?: string;
  }>;
  errorsAndFixes: Array<{
    error: string;
    fix: string;
  }>;
  problemSolving: string;
  userMessages: string[];
  pendingTasks: string[];
  currentWork: string;
  nextStep: string;
}

export interface SessionNotes {
  technicalConcepts: string[];
  fileChanges: Array<{
    file: string;
    action: 'created' | 'modified' | 'deleted';
    timestamp: string;
    summary?: string;
  }>;
  errors: Array<{
    message: string;
    fix?: string;
    timestamp: string;
  }>;
  pendingTasks: Array<{
    task: string;
    status: 'pending' | 'completed';
  }>;
}
