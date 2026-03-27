import type { PersonRef } from "@/features/people/types";

export interface CommentRef {
  id: string;
  externalId: string;
  threadId?: string;
  parentCommentId?: string;
  entityType: "task" | "project";
  entityId: string;
  body: string;
  bodyFormat: "plain-text" | "markdown" | "html";
  author: PersonRef;
  createdAt: string;
  updatedAt?: string;
  edited: boolean;
  mentions: PersonRef[];
}
