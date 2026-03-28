export const defaultMicrosoftGraphBaseUrl = "https://graph.microsoft.com/v1.0"
export const defaultMicrosoftGraphScopes = ["User.Read", "Sites.Read.All", "Lists.ReadWrite"] as const

export type GraphAccessTokenProvider = () => Promise<string>

export interface MicrosoftGraphRuntimeConfig {
  baseUrl?: string
  scopes?: string[]
  accessTokenProvider?: GraphAccessTokenProvider
  fetch?: typeof fetch
}

export function createMicrosoftGraphRuntimeConfig(
  overrides: MicrosoftGraphRuntimeConfig = {},
): Required<Pick<MicrosoftGraphRuntimeConfig, "baseUrl" | "scopes">> & MicrosoftGraphRuntimeConfig {
  return {
    baseUrl: overrides.baseUrl ?? defaultMicrosoftGraphBaseUrl,
    scopes: overrides.scopes ?? [...defaultMicrosoftGraphScopes],
    accessTokenProvider: overrides.accessTokenProvider,
    fetch: overrides.fetch,
  }
}

export function buildGraphListItemsUrl(
  baseUrl: string,
  options: {
    siteId: string
    listId: string
    selectFields?: string[]
    top?: number
    filter?: string
  },
) {
  const url = new URL(`${baseUrl}/sites/${encodeURIComponent(options.siteId)}/lists/${encodeURIComponent(options.listId)}/items`)

  if (options.selectFields?.length) {
    url.searchParams.set("$expand", `fields(select=${options.selectFields.join(",")})`)
  } else {
    url.searchParams.set("$expand", "fields")
  }

  if (options.top !== undefined) {
    url.searchParams.set("$top", String(options.top))
  }

  if (options.filter) {
    url.searchParams.set("$filter", options.filter)
  }

  return url.toString()
}

export function buildGraphListCommentsUrl(
  baseUrl: string,
  options: {
    siteId: string
    listId: string
    itemId: string
  },
) {
  return `${baseUrl}/sites/${encodeURIComponent(options.siteId)}/lists/${encodeURIComponent(options.listId)}/items/${encodeURIComponent(options.itemId)}/comments`
}

export function buildGraphListColumnsUrl(
  baseUrl: string,
  options: {
    siteId: string
    listId: string
  },
) {
  return `${baseUrl}/sites/${encodeURIComponent(options.siteId)}/lists/${encodeURIComponent(options.listId)}/columns`
}

// ---------------------------------------------------------------------------
// NEV-14: URL builders for single-item read, write operations, and discovery
// ---------------------------------------------------------------------------

export function buildGraphGetItemUrl(
  baseUrl: string,
  options: {
    siteId: string
    listId: string
    itemId: string
    selectFields?: string[]
  },
) {
  const url = new URL(
    `${baseUrl}/sites/${encodeURIComponent(options.siteId)}/lists/${encodeURIComponent(options.listId)}/items/${encodeURIComponent(options.itemId)}`,
  )

  if (options.selectFields?.length) {
    url.searchParams.set("$expand", `fields(select=${options.selectFields.join(",")})`)
  } else {
    url.searchParams.set("$expand", "fields")
  }

  return url.toString()
}

export function buildGraphCreateItemUrl(
  baseUrl: string,
  options: { siteId: string; listId: string },
) {
  return `${baseUrl}/sites/${encodeURIComponent(options.siteId)}/lists/${encodeURIComponent(options.listId)}/items`
}

export function buildGraphUpdateItemFieldsUrl(
  baseUrl: string,
  options: { siteId: string; listId: string; itemId: string },
) {
  return `${baseUrl}/sites/${encodeURIComponent(options.siteId)}/lists/${encodeURIComponent(options.listId)}/items/${encodeURIComponent(options.itemId)}/fields`
}

export function buildGraphDeleteItemUrl(
  baseUrl: string,
  options: { siteId: string; listId: string; itemId: string },
) {
  return `${baseUrl}/sites/${encodeURIComponent(options.siteId)}/lists/${encodeURIComponent(options.listId)}/items/${encodeURIComponent(options.itemId)}`
}

export function buildGraphCreateCommentUrl(
  baseUrl: string,
  options: { siteId: string; listId: string; itemId: string },
) {
  return `${baseUrl}/sites/${encodeURIComponent(options.siteId)}/lists/${encodeURIComponent(options.listId)}/items/${encodeURIComponent(options.itemId)}/comments`
}

export function buildGraphSearchSitesUrl(
  baseUrl: string,
  query?: string,
) {
  const url = new URL(`${baseUrl}/sites`)

  if (query) {
    url.searchParams.set("search", query)
  }

  return url.toString()
}

export function buildGraphSiteListsUrl(
  baseUrl: string,
  siteId: string,
) {
  return `${baseUrl}/sites/${encodeURIComponent(siteId)}/lists`
}
