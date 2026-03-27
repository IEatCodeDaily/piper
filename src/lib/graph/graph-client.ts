import {
  buildGraphListColumnsUrl,
  buildGraphListCommentsUrl,
  buildGraphListItemsUrl,
  createMicrosoftGraphRuntimeConfig,
  type MicrosoftGraphRuntimeConfig,
} from "@/lib/graph/graph-config";
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
  GraphListColumnDefinition,
  GraphListColumnsRequest,
  GraphListItem,
  GraphListItemComment,
  GraphListItemCommentsRequest,
  GraphListItemsRequest,
  GraphListMetadata,
  GraphListReference,
} from "@/lib/graph/types";

export interface GraphClient {
  getListMetadata(reference: GraphListReference): Promise<GraphListMetadata>;
  listColumns(request: GraphListColumnsRequest): Promise<GraphCollectionResponse<GraphListColumnDefinition>>;
  listItems(request: GraphListItemsRequest): Promise<GraphCollectionResponse<GraphListItem>>;
  listComments(request: GraphListItemCommentsRequest): Promise<GraphCollectionResponse<GraphListItemComment>>;
}

async function parseGraphResponse<TValue>(response: Response): Promise<TValue> {
  if (!response.ok) {
    throw new Error(`Microsoft Graph request failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<TValue>;
}

export class FetchGraphClient implements GraphClient {
  private readonly runtimeConfig: ReturnType<typeof createMicrosoftGraphRuntimeConfig>;

  constructor(runtimeConfig: MicrosoftGraphRuntimeConfig = {}) {
    this.runtimeConfig = createMicrosoftGraphRuntimeConfig(runtimeConfig);
  }

  private async createHeaders() {
    const headers = new Headers({
      Accept: "application/json",
    });

    const accessToken = await this.runtimeConfig.accessTokenProvider?.();
    if (accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }

    return headers;
  }

  async getListMetadata(reference: GraphListReference): Promise<GraphListMetadata> {
    return {
      ...reference,
      displayName: reference.label,
    };
  }

  async listColumns(request: GraphListColumnsRequest) {
    const fetchImpl = this.runtimeConfig.fetch ?? fetch;
    const response = await fetchImpl(buildGraphListColumnsUrl(this.runtimeConfig.baseUrl, request), {
      headers: await this.createHeaders(),
    });

    return parseGraphResponse<GraphCollectionResponse<GraphListColumnDefinition>>(response);
  }

  async listItems(request: GraphListItemsRequest) {
    const fetchImpl = this.runtimeConfig.fetch ?? fetch;
    const response = await fetchImpl(buildGraphListItemsUrl(this.runtimeConfig.baseUrl, request), {
      headers: await this.createHeaders(),
    });

    return parseGraphResponse<GraphCollectionResponse<GraphListItem>>(response);
  }

  async listComments(request: GraphListItemCommentsRequest) {
    const fetchImpl = this.runtimeConfig.fetch ?? fetch;
    const response = await fetchImpl(buildGraphListCommentsUrl(this.runtimeConfig.baseUrl, request), {
      headers: await this.createHeaders(),
    });

    return parseGraphResponse<GraphCollectionResponse<GraphListItemComment>>(response);
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
}

export const mockGraphClient = new MockGraphClient();
