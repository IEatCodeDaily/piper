import type { WorkspaceConfig, WorkspaceEntityScope } from "@/features/workspaces/types";

export type GraphEntityScope = WorkspaceEntityScope;

export interface GraphIdentity {
  id?: string;
  displayName?: string;
  email?: string;
  userPrincipalName?: string;
}

export interface GraphIdentitySet {
  user?: GraphIdentity;
  application?: GraphIdentity;
  device?: GraphIdentity;
}

export interface GraphFieldPersonValue {
  LookupId?: number;
  LookupValue?: string;
  Email?: string;
  DisplayName?: string;
  Claims?: string;
  Department?: string;
  JobTitle?: string;
  Picture?: string;
}

export interface GraphFieldLookupValue {
  LookupId: number;
  LookupValue?: string;
}

export interface GraphListItemCommentMention {
  id: string;
  mentionText: string;
  mentioned: GraphIdentitySet;
}

export interface GraphListItemComment {
  id: string;
  createdDateTime: string;
  lastModifiedDateTime?: string;
  content: string;
  contentType: "text" | "html";
  createdBy: GraphIdentitySet;
  mentions?: GraphListItemCommentMention[];
}

export type GraphListFieldPrimitive = string | number | boolean | null;

export type GraphListFieldValue =
  | GraphListFieldPrimitive
  | GraphListFieldPrimitive[]
  | GraphFieldPersonValue
  | GraphFieldPersonValue[]
  | GraphFieldLookupValue
  | GraphFieldLookupValue[];

export interface GraphListItemFields {
  [fieldName: string]: GraphListFieldValue | undefined;
}

export interface GraphSharePointIds {
  listId?: string;
  listItemId?: string;
  listItemUniqueId?: string;
  siteId?: string;
  webId?: string;
}

export interface GraphListItem {
  id: string;
  etag?: string;
  webUrl?: string;
  createdDateTime: string;
  lastModifiedDateTime: string;
  createdBy: GraphIdentitySet;
  lastModifiedBy: GraphIdentitySet;
  sharepointIds?: GraphSharePointIds;
  fields: GraphListItemFields;
}

export interface GraphCollectionResponse<TValue> {
  value: TValue[];
  nextLink?: string;
}

export interface GraphListReference {
  siteId: string;
  listId: string;
  label?: string;
}

export type GraphColumnDataType =
  | "text"
  | "note"
  | "number"
  | "boolean"
  | "dateTime"
  | "person"
  | "personMulti"
  | "choice"
  | "choiceMulti"
  | "lookup"
  | "lookupMulti"
  | "url"
  | "unknown";

export interface GraphListColumnDefinition {
  id: string;
  name: string;
  displayName: string;
  dataType: GraphColumnDataType;
  readOnly?: boolean;
  required?: boolean;
  multiValue?: boolean;
  hidden?: boolean;
}

export interface GraphListItemsRequest extends GraphListReference {
  selectFields?: string[];
  top?: number;
  filter?: string;
}

export interface GraphListItemCommentsRequest extends GraphListReference {
  itemId: string;
}

export type GraphListColumnsRequest = GraphListReference;

export interface GraphListMetadata extends GraphListReference {
  webUrl?: string;
  displayName?: string;
}

export interface GraphWorkspaceBinding {
  config: WorkspaceConfig;
  active?: boolean;
}

export interface GraphWorkspaceContext {
  workspaceId: string;
  scope: GraphEntityScope;
  config: WorkspaceConfig;
  list: GraphListReference;
}

// ---------------------------------------------------------------------------
// NEV-14: Request types for write operations, single-item read, and discovery
// ---------------------------------------------------------------------------

export interface GraphGetItemRequest extends GraphListReference {
  itemId: string;
  selectFields?: string[];
}

export interface GraphCreateItemRequest extends GraphListReference {
  fields: GraphListItemFields;
}

export interface GraphUpdateItemFieldsRequest extends GraphListReference {
  itemId: string;
  fields: GraphListItemFields;
}

export interface GraphDeleteItemRequest extends GraphListReference {
  itemId: string;
}

export interface GraphCreateCommentRequest extends GraphListReference {
  itemId: string;
  body: {
    content: string;
    contentType: "text" | "html";
  };
}

// ---------------------------------------------------------------------------
// NEV-14: Discovery types
// ---------------------------------------------------------------------------

export interface GraphSite {
  id: string;
  displayName: string;
  name: string;
  webUrl: string;
  description?: string;
}

export interface GraphListInfo {
  id: string;
  displayName: string;
  name: string;
  webUrl?: string;
  description?: string;
  list?: {
    template?: string;
    hidden?: boolean;
    contentTypesEnabled?: boolean;
  };
}
