export enum GitStatus {
  Untracked = 'Untracked',
  Modified = 'Modified',
  Added = 'Added',
  Deleted = 'Deleted',
  Renamed = 'Renamed',
  TypeChange = 'TypeChange',
  Conflicted = 'Conflicted',
  Ignored = 'Ignored',
  Unmodified = 'Unmodified',
  Unknown = 'Unknown',
}

export interface FileNode {
  id: string;
  name: string;
  path: string;
  kind: 'file' | 'directory';
  children?: FileNode[];
  isExpanded?: boolean;
  gitStatus?: GitStatus;
}

export interface OpenedFile {
  id: string; // uuid or path
  path: string;
  name: string;
  content: string;
  isDirty: boolean;
  language: string;
  initialLine?: number;
}
