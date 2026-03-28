import {
  buildGraphListColumnsUrl,
  buildGraphListCommentsUrl,
  buildGraphListItemsUrl,
  buildGraphGetItemUrl,
  buildGraphCreateItemUrl,
  buildGraphUpdateItemFieldsUrl,
  buildGraphDeleteItemUrl,
  buildGraphCreateCommentUrl,
  buildGraphSearchSitesUrl,
  buildGraphSiteListsUrl,
  createMicrosoftGraphRuntimeConfig,
  type MicrosoftGraphRuntimeConfig,
} from "@/lib/graph/graph-config";
import {
  parseGraphErrorResponse,
  withGraphRetry,
} from "@/lib/graph/graph-errors";
import {
  cloneGraphComment,
  cloneGraphListColumn,
  cloneGraphListItem,
  mockGraphCommentCollectionsByItemId,
  mockGraphDisplayNames,
  mockGraphListColumnsByScope,
  mockGraphListKeyByScope,
  mockGraphProjectCollection,
  mockGraphTaskCollection,
} from "@/lib/graph/mock-graph-payloads";
import type {
  GraphCollectionResponse,
  GraphCreateCommentRequest,
  GraphCreateItemRequest,
  GraphDeleteItemRequest,
  GraphGetItemRequest,
  GraphListColumnDefinition,
  GraphListColumnsRequest,
  GraphListInfo,
  GraphListItem,
  GraphListItemComment,
  GraphListItemCommentsRequest,
  GraphListItemsRequest,
  GraphListMetadata,
  GraphListReference,
  GraphSite,
  GraphUpdateItemFieldsRequest,
} from "@/lib/graph/types";

export interface GraphClient {
  // -- Read operations -------------------------------------------------------
  getListMetadata(reference: GraphListReference): Promise<GraphListMetadata>;
  listColumns(request: GraphListColumnsRequest): Promise<GraphCollectionResponse<GraphListColumnDefinition>>;
  listItems(request: GraphListItemsRequest): Promise<GraphCollectionResponse<GraphListItem>>;
  listComments(request: GraphListItemCommentsRequest): Promise<GraphCollectionResponse<GraphListItemComment>>;

  // -- Single item read (NEV-14) ---------------------------------------------
  getItem(request: GraphGetItemRequest): Promise<GraphListItem>;

  // -- Write operations (NEV-14) ---------------------------------------------
  createItem(request: GraphCreateItemRequest): Promise<GraphListItem>;
  updateItemFields(request: GraphUpdateItemFieldsRequest): Promise<GraphListItem>;
  deleteItem(request: GraphDeleteItemRequest): Promise<void>;
  createComment(request: GraphCreateCommentRequest): Promise<GraphListItemComment>;

  // -- Discovery (NEV-14) ----------------------------------------------------
  listSites(query?: string): Promise<GraphCollectionResponse<GraphSite>>;
  listSiteLists(siteId: string): Promise<GraphCollectionResponse<GraphListInfo>>;

  // -- Pagination helper (NEV-14) --------------------------------------------
  listAllItems(request: GraphListItemsRequest): Promise<GraphListItem[]>;
}

async function parseGraphResponse<TValue>(response: Response): Promise<TValue> {
  if (!response.ok) {
    throw await parseGraphErrorResponse(response);
  }

  return response.json() as Promise<TValue>;
}

export class FetchGraphClient implements GraphClient {
  private readonly runtimeConfig: ReturnType<typeof createMicrosoftGraphRuntimeConfig>;

  constructor(runtimeConfig: MicrosoftGraphRuntimeConfig = {}) {
    this.runtimeConfig = createMicrosoftGraphRuntimeConfig(runtimeConfig);
  }

  private async createHeaders(includeContentType = false) {
    const headers = new Headers({
      Accept: "application/json",
    });

    if (includeContentType) {
      headers.set("Content-Type", "application/json");
    }

    const accessToken = await this.runtimeConfig.accessTokenProvider?.();
    if (accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }

    return headers;
  }

  private get fetchImpl() {
    return this.runtimeConfig.fetch ?? fetch;
  }

  // -- Read operations -------------------------------------------------------

  async getListMetadata(reference: GraphListReference): Promise<GraphListMetadata> {
    return {
      ...reference,
      displayName: reference.label,
    };
  }

  async listColumns(request: GraphListColumnsRequest) {
    return withGraphRetry(async () => {
      const response = await this.fetchImpl(buildGraphListColumnsUrl(this.runtimeConfig.baseUrl, request), {
        headers: await this.createHeaders(),
      });
      return parseGraphResponse<GraphCollectionResponse<GraphListColumnDefinition>>(response);
    });
  }

  async listItems(request: GraphListItemsRequest) {
    return withGraphRetry(async () => {
      const response = await this.fetchImpl(buildGraphListItemsUrl(this.runtimeConfig.baseUrl, request), {
        headers: await this.createHeaders(),
      });
      return parseGraphResponse<GraphCollectionResponse<GraphListItem>>(response);
    });
  }

  async listComments(request: GraphListItemCommentsRequest) {
    return withGraphRetry(async () => {
      const response = await this.fetchImpl(buildGraphListCommentsUrl(this.runtimeConfig.baseUrl, request), {
        headers: await this.createHeaders(),
      });
      return parseGraphResponse<GraphCollectionResponse<GraphListItemComment>>(response);
    });
  }

  // -- Single item read (NEV-14) ---------------------------------------------

  async getItem(request: GraphGetItemRequest): Promise<GraphListItem> {
    return withGraphRetry(async () => {
      const response = await this.fetchImpl(buildGraphGetItemUrl(this.runtimeConfig.baseUrl, request), {
        headers: await this.createHeaders(),
      });
      return parseGraphResponse<GraphListItem>(response);
    });
  }

  // -- Write operations (NEV-14) ---------------------------------------------

  async createItem(request: GraphCreateItemRequest): Promise<GraphListItem> {
    return withGraphRetry(async () => {
      const response = await this.fetchImpl(buildGraphCreateItemUrl(this.runtimeConfig.baseUrl, request), {
        method: "POST",
        headers: await this.createHeaders(true),
        body: JSON.stringify({ fields: request.fields }),
      });
      return parseGraphResponse<GraphListItem>(response);
    });
  }

  async updateItemFields(request: GraphUpdateItemFieldsRequest): Promise<GraphListItem> {
    return withGraphRetry(async () => {
      const response = await this.fetchImpl(buildGraphUpdateItemFieldsUrl(this.runtimeConfig.baseUrl, request), {
        method: "PATCH",
        headers: await this.createHeaders(true),
        body: JSON.stringify(request.fields),
      });
      return parseGraphResponse<GraphListItem>(response);
    });
  }

  async deleteItem(request: GraphDeleteItemRequest): Promise<void> {
    return withGraphRetry(async () => {
      const response = await this.fetchImpl(buildGraphDeleteItemUrl(this.runtimeConfig.baseUrl, request), {
        method: "DELETE",
        headers: await this.createHeaders(),
      });
      if (!response.ok) {
        throw await parseGraphErrorResponse(response, "Delete item");
      }
    });
  }

  async createComment(request: GraphCreateCommentRequest): Promise<GraphListItemComment> {
    return withGraphRetry(async () => {
      const response = await this.fetchImpl(buildGraphCreateCommentUrl(this.runtimeConfig.baseUrl, request), {
        method: "POST",
        headers: await this.createHeaders(true),
        body: JSON.stringify(request.body),
      });
      return parseGraphResponse<GraphListItemComment>(response);
    });
  }

  // -- Discovery (NEV-14) ----------------------------------------------------

  async listSites(query?: string): Promise<GraphCollectionResponse<GraphSite>> {
    return withGraphRetry(async () => {
      const response = await this.fetchImpl(buildGraphSearchSitesUrl(this.runtimeConfig.baseUrl, query), {
        headers: await this.createHeaders(),
      });
      return parseGraphResponse<GraphCollectionResponse<GraphSite>>(response);
    });
  }

  async listSiteLists(siteId: string): Promise<GraphCollectionResponse<GraphListInfo>> {
    return withGraphRetry(async () => {
      const response = await this.fetchImpl(buildGraphSiteListsUrl(this.runtimeConfig.baseUrl, siteId), {
        headers: await this.createHeaders(),
      });
      return parseGraphResponse<GraphCollectionResponse<GraphListInfo>>(response);
    });
  }

  // -- Pagination helper (NEV-14) --------------------------------------------

  async listAllItems(request: GraphListItemsRequest): Promise<GraphListItem[]> {
    const allItems: GraphListItem[] = [];

    let page = await this.listItems(request);
    allItems.push(...page.value);

    while (page.nextLink) {
      const response = await withGraphRetry(async () => {
        const res = await this.fetchImpl(page.nextLink!, {
          headers: await this.createHeaders(),
        });
        return parseGraphResponse<GraphCollectionResponse<GraphListItem>>(res);
      });
      allItems.push(...response.value);
      page = response;
    }

    return allItems;
  }
}

function createMockListKey(reference: GraphListReference) {
  return `${reference.siteId}::${reference.listId}`;
}

export class MockGraphClient implements GraphClient {
  async getListMetadata(reference: GraphListReference): Promise<GraphListMetadata> {
    const key = createMockListKey(reference);

    if (key === mockGraphListKeyByScope.projects) {
      return {
        ...reference,
        displayName: mockGraphDisplayNames.projects,
      };
    }

    if (key === mockGraphListKeyByScope.tasks) {
      return {
        ...reference,
        displayName: mockGraphDisplayNames.tasks,
      };
    }

    throw new Error(`No mock Graph list metadata is registered for ${key}.`);
  }

  async listColumns(request: GraphListColumnsRequest) {
    const key = createMockListKey(request);

    if (key === mockGraphListKeyByScope.projects) {
      return { value: mockGraphListColumnsByScope.projects.map(cloneGraphListColumn) };
    }

    if (key === mockGraphListKeyByScope.tasks) {
      return { value: mockGraphListColumnsByScope.tasks.map(cloneGraphListColumn) };
    }

    throw new Error(`No mock Graph list columns are registered for ${key}.`);
  }

  async listItems(request: GraphListItemsRequest) {
    const key = createMockListKey(request);

    if (key === mockGraphListKeyByScope.projects) {
      return {
        value: mockGraphProjectCollection.value.map(cloneGraphListItem),
      };
    }

    if (key === mockGraphListKeyByScope.tasks) {
      return {
        value: mockGraphTaskCollection.value.map(cloneGraphListItem),
      };
    }

    throw new Error(`No mock Graph list payload is registered for ${key}.`);
  }

  async listComments(request: GraphListItemCommentsRequest) {
    const collection = mockGraphCommentCollectionsByItemId[request.itemId];

    return {
      value: collection?.value.map(cloneGraphComment) ?? [],
    };
  }

  // -- NEV-14: Write + Discovery stubs for MockGraphClient --------------------

  private mockItemCounter = 100;
  private mockCreatedItems = new Map<string, GraphListItem>();

  async getItem(request: GraphGetItemRequest): Promise<GraphListItem> {
    // Check mock-created items first
    const created = this.mockCreatedItems.get(request.itemId);
    if (created) return cloneGraphListItem(created);

    // Fall back to looking in the collection
    const key = createMockListKey(request);
    let collection: { value: GraphListItem[] } | undefined;

    if (key === mockGraphListKeyByScope.tasks) {
      collection = mockGraphTaskCollection;
    } else if (key === mockGraphListKeyByScope.projects) {
      collection = mockGraphProjectCollection;
    }

    const item = collection?.value.find((i) => i.id === request.itemId);
    if (!item) throw new Error(`Mock: item ${request.itemId} not found`);
    return cloneGraphListItem(item);
  }

  async createItem(request: GraphCreateItemRequest): Promise<GraphListItem> {
    const id = String(++this.mockItemCounter);
    const now = new Date().toISOString();
    const item: GraphListItem = {
      id,
      createdDateTime: now,
      lastModifiedDateTime: now,
      createdBy: { user: { displayName: "Mock User" } },
      lastModifiedBy: { user: { displayName: "Mock User" } },
      fields: { ...request.fields },
    };
    this.mockCreatedItems.set(id, item);
    return cloneGraphListItem(item);
  }

  async updateItemFields(request: GraphUpdateItemFieldsRequest): Promise<GraphListItem> {
    const existing = this.mockCreatedItems.get(request.itemId);
    if (existing) {
      existing.fields = { ...existing.fields, ...request.fields };
      existing.lastModifiedDateTime = new Date().toISOString();
      return cloneGraphListItem(existing);
    }
    // Return a synthetic updated item for items from static mock data
    return {
      id: request.itemId,
      createdDateTime: new Date().toISOString(),
      lastModifiedDateTime: new Date().toISOString(),
      createdBy: { user: { displayName: "Mock User" } },
      lastModifiedBy: { user: { displayName: "Mock User" } },
      fields: { ...request.fields },
    };
  }

  async deleteItem(request: GraphDeleteItemRequest): Promise<void> {
    this.mockCreatedItems.delete(request.itemId);
  }

  async createComment(_request: GraphCreateCommentRequest): Promise<GraphListItemComment> {
    return {
      id: `mock-comment-${++this.mockItemCounter}`,
      createdDateTime: new Date().toISOString(),
      content: _request.body.content,
      contentType: _request.body.contentType,
      createdBy: { user: { displayName: "Mock User" } },
    };
  }

  async listSites(_query?: string): Promise<GraphCollectionResponse<GraphSite>> {
    return {
      value: [
        {
          id: "mock-site-001",
          displayName: "Mock SharePoint Site",
          webUrl: "https://contoso.sharepoint.com/sites/mock",
          name: "mock",
        },
      ],
    };
  }

  async listSiteLists(_siteId: string): Promise<GraphCollectionResponse<GraphListInfo>> {
    return {
      value: [
        {
          id: "mock-list-tasks",
          name: "tasks",
          displayName: "Tasks",
          description: "Mock tasks list",
          list: { template: "genericList", hidden: false, contentTypesEnabled: false },
        },
        {
          id: "mock-list-projects",
          name: "projects",
          displayName: "Projects",
          description: "Mock projects list",
          list: { template: "genericList", hidden: false, contentTypesEnabled: false },
        },
      ],
    };
  }

  async listAllItems(request: GraphListItemsRequest): Promise<GraphListItem[]> {
    const result = await this.listItems(request);
    return result.value;
  }
}

export const mockGraphClient = new MockGraphClient();
