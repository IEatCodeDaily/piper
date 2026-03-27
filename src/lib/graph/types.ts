import type { WorkspaceConfig, WorkspaceEntityScope } from "@/features/workspaces/types"

export type GraphEntityScope = WorkspaceEntityScope

export interface GraphIdentity {
  id?: string
  displayName?: string
  email?: string
  userPrincipalName?: string
}

export interface GraphIdentitySet {
  user?: GraphIdentity
  application?: GraphIdentity
  device?: GraphIdentity
}

export interface GraphFieldPersonValue {
  LookupId?: number
  LookupValue?: string
  Email?: string
  DisplayName?: string
  Claims?: string
  Department?: string
  JobTitle?: string
  Picture?: string
}

export interface GraphFieldLookupValue {
  LookupId: number
  LookupValue?: string
}

export interface GraphListItemCommentMention {
  id: string
  mentionText: string
  mentioned: GraphIdentitySet
}

export interface GraphListItemComment {
  id: string
  createdDateTime: string
  lastModifiedDateTime?: string
  content: string
  contentType: "text" | "html"
  createdBy: GraphIdentitySet
  mentions?: GraphListItemCommentMention[]
}

export type GraphListFieldPrimitive = string | number | boolean | null

export type GraphListFieldValue =
  | GraphListFieldPrimitive
  | GraphListFieldPrimitive[]
  | GraphFieldPersonValue
  | GraphFieldPersonValue[]
  | GraphFieldLookupValue
  | GraphFieldLookupValue[]

export interface GraphListItemFields {
  [fieldName: string]: GraphListFieldValue | undefined
}

export interface GraphSharePointIds {
  listId?: string
  listItemId?: string
  listItemUniqueId?: string
  siteId?: string
  webId?: string
}

export interface GraphListItem {
  id: string
  etag?: string
  webUrl?: string
  createdDateTime: string
  lastModifiedDateTime: string
  createdBy: GraphIdentitySet
  lastModifiedBy: GraphIdentitySet
  sharepointIds?: GraphSharePointIds
  fields: GraphListItemFields
}

export interface GraphCollectionResponse<TValue> {
  value: TValue[]
  nextLink?: string
}

export interface GraphListReference {
  siteId: string
  listId: string
  label?: string
}

export interface GraphListItemsRequest extends GraphListReference {
  selectFields?: string[]
  top?: number
  filter?: string
}

export interface GraphListItemCommentsRequest extends GraphListReference {
  itemId: string
}

export interface GraphListMetadata extends GraphListReference {
  webUrl?: string
  displayName?: string
}

export interface GraphWorkspaceBinding {
  config: WorkspaceConfig
  active?: boolean
}

export interface GraphWorkspaceContext {
  workspaceId: string
  scope: GraphEntityScope
  config: WorkspaceConfig
  list: GraphListReference
}
