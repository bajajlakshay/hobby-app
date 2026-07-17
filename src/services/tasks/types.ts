export interface ChecklistItem {
  id: string;
  text: string;
  isCompleted: boolean;
}

/** Task as returned by the backend. */
export interface Task {
  id: string;
  title: string;
  items: ChecklistItem[];
  completedCount: number;
  totalCount: number;
  createdAt: string;
  updatedAt: string | null;
  reminderAt: string | null;
}

export interface SaveTaskPayload {
  title: string;
  items: { id?: string; text: string; isCompleted: boolean }[];
  reminderAt: string | null;
}
