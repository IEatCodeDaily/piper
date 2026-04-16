# NEV-23: Generic REST/GraphQL Backend Adapter Framework

> **Status**: RFC / Architecture Spec
> **Author**: Kyosai (System Architect)
> **Date**: 2026-03-30
> **Issue**: NEV-23
> **Dependencies**: Phases 1–5 (MS Lists, GitHub, Jira, SQLite, Linear)

---

## 1. Problem Statement

Piper currently has five concrete backend adapters (MS Lists, GitHub Issues, Jira Cloud, SQLite, Linear), each implemented as hand-written TypeScript classes against the `IssueStore` / `SchemaMapper` / `AuthProvider` interfaces. This approach has three structural costs:

1. **N×M adapter surface** — every new tracker requires a full adapter implementation (~400–800 lines), even when the tracker is "just a REST API with tasks."
2. **No user extensibility** — only developers can add backends. Users who want to connect Piper to Trello, Asana, Notion, or a custom internal tracker are blocked.
3. **Schema duplication** — each adapter re-implements the same field-mapping, pagination, and auth patterns with slight variations.

The generic adapter framework eliminates all three by making adapters *configurable* rather than *codeable* for any backend that speaks REST or GraphQL.

---

## 2. Design Goals

| # | Goal | Constraint |
|---|------|-----------|
| G1 | A JSON config file is sufficient to connect Piper to any REST or GraphQL API | No code required for standard CRUD backends |
| G2 | Existing concrete adapters continue to work unchanged | Zero breaking changes to `IssueStore`, `SchemaMapper`, `AuthProvider`, or `BackendRegistry` |
| G3 | The generic adapter validates its config at load time and surfaces actionable errors | Fail-fast, not fail-at-runtime |
| G4 | Response parsing supports JSONPath and JMESPath | Users can map nested response shapes |
| G5 | Auth supports Bearer token, API key, OAuth2 client-credentials/authorization-code, and Basic auth | Extensible via plugin |
| G6 | A plugin system allows custom adapter logic without forking Piper | JS/TS modules loaded at runtime |

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Piper Application Core                │
│                                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ IssueStore   │  │ SchemaMapper │  │  AuthProvider  │  │
│  │  (interface) │  │  (interface) │  │  (interface)   │  │
│  └──────┬──────┘  └──────┬───────┘  └───────┬───────┘  │
│         │                │                   │          │
│  ┌──────▼────────────────▼───────────────────▼───────┐  │
│  │          GenericAdapterFactory                     │  │
│  │  Reads AdapterConfig → produces IssueStore +      │  │
│  │  SchemaMapper + AuthProvider                      │  │
│  └──────────┬────────────────────────────────────────┘  │
│             │                                           │
│  ┌──────────▼────────────────────────────────────────┐  │
│  │           AdapterConfig (JSON Schema)              │  │
│  │  - api.type: "rest" | "graphql"                    │  │
│  │  - api.baseUrl, endpoints, pagination              │  │
│  │  - auth: { type, ... }                             │  │
│  │  - fieldMappings                                   │  │
│  │  - responseParsers                                 │  │
│  │  - capabilities                                    │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │           Plugin System                            │  │
│  │  - Custom auth handlers                            │  │
│  │  - Custom response parsers                         │  │
│  │  - Custom mutation builders                        │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 4. Adapter Configuration Schema

### 4.1 Top-Level Structure

```typescript
// src/lib/store/generic/types.ts

export interface AdapterConfig {
  /** Unique identifier for this adapter configuration. */
  id: string;

  /** Human-readable label. */
  label: string;

  /** Backend type discriminator — always "generic" for config-driven adapters. */
  type: "generic";

  /** API protocol and connection details. */
  api: RestApiConfig | GraphQLApiConfig;

  /** Authentication configuration. */
  auth: AuthConfig;

  /** Entity endpoint definitions. */
  entities: EntityDefinitions;

  /** Declared backend capabilities. */
  capabilities: StoreCapabilities;

  /** Optional custom plugins (module paths or inline functions). */
  plugins?: PluginConfig[];
}
```

### 4.2 REST API Configuration

```typescript
export interface RestApiConfig {
  type: "rest";
  /** Base URL for all endpoints (e.g. "https://api.example.com/v1"). */
  baseUrl: string;

  /** Default headers applied to all requests. */
  defaultHeaders?: Record<string, string>;

  /** Request timeout in milliseconds. */
  timeout?: number;

  /** Pagination style. */
  pagination: PaginationConfig;

  /** Entity-specific endpoint templates. */
  endpoints: RestEntityEndpoints;
}

export interface RestEntityEndpoints {
  tasks: RestEndpointSet;
  projects: RestEndpointSet;
  comments?: RestEndpointSet;
  people?: RestEndpointSet;
}

export interface RestEndpointSet {
  /** URL template for listing. Supports {query.*} interpolation. */
  list: string;
  /** URL template for fetching a single item. Supports {id}. */
  get: string;
  /** URL template for creating. */
  create: string;
  /** URL template for updating. Supports {id}. */
  update: string;
  /** URL template for deleting. Supports {id}. */
  delete?: string;

  /** HTTP methods (override defaults). */
  methods?: {
    list?: "GET";
    get?: "GET";
    create?: "POST";
    update?: "PATCH" | "PUT";
    delete?: "DELETE";
  };
}
```

**URL template variables**: `{id}`, `{projectId}`, `{assigneeId}`, `{parentId}`, `{entityType}`, `{entityId}`, plus any custom variable from the query context.

### 4.3 GraphQL API Configuration

```typescript
export interface GraphQLApiConfig {
  type: "graphql";
  /** GraphQL endpoint URL. */
  url: string;

  /** Default headers (e.g. for API key). */
  defaultHeaders?: Record<string, string>;

  /** Request timeout in milliseconds. */
  timeout?: number;

  /** Pagination style. */
  pagination: PaginationConfig;

  /** GraphQL operations for each entity. */
  operations: GraphQLEntityOperations;
}

export interface GraphQLEntityOperations {
  tasks: GraphQLOperationSet;
  projects: GraphQLOperationSet;
  comments?: GraphQLOperationSet;
  people?: GraphQLOperationSet;
}

export interface GraphQLOperationSet {
  /** Query/mutation body for listing. */
  list: GraphQLStatement;
  /** Query body for single item. */
  get: GraphQLStatement;
  /** Mutation body for creating. */
  create: GraphQLStatement;
  /** Mutation body for updating. */
  update: GraphQLStatement;
  /** Mutation body for deleting (optional). */
  delete?: GraphQLStatement;

  /** Variables mapping: Piper query params → GraphQL variable names. */
  variables?: Record<string, VariableMapping>;
}

export interface GraphQLStatement {
  /** The GraphQL query/mutation string. */
  body: string;
  /** The path within the response `data` to extract items (JSONPath). */
  dataPath: string;
  /** The path to the connection's nodes array (for paginated queries). */
  nodesPath?: string;
  /** The path to the page info (for cursor pagination). */
  pageInfoPath?: string;
}

export interface VariableMapping {
  /** Source Piper field (e.g. "projectId", "assigneeId", "statuses"). */
  source: string;
  /** GraphQL variable name. */
  target: string;
  /** Optional transform: "array-to-comma-string", "array-to-gql-enum-array", etc. */
  transform?: string;
}
```

### 4.4 Pagination Configuration

```typescript
export type PaginationConfig =
  | OffsetPagination
  | CursorPagination
  | LinkHeaderPagination
  | NoPagination;

export interface OffsetPagination {
  type: "offset";
  /** Query parameter name for offset. */
  offsetParam: string;
  /** Query parameter name for limit. */
  limitParam: string;
  /** JSONPath to total count in response (optional — enables accurate hasMore). */
  totalCountPath?: string;
  /** Default page size. */
  defaultPageSize: number;
  /** Maximum page size. */
  maxPageSize: number;
}

export interface CursorPagination {
  type: "cursor";
  /** Query parameter name for cursor (after). */
  cursorParam: string;
  /** Query parameter name for limit. */
  limitParam: string;
  /** JSONPath to next cursor in response. */
  nextCursorPath: string;
  /** JSONPath to hasMore boolean in response. */
  hasMorePath?: string;
  /** Default page size. */
  defaultPageSize: number;
}

export interface LinkHeaderPagination {
  type: "link-header";
  /** Default page size. */
  defaultPageSize: number;
}

export interface NoPagination {
  type: "none";
}
```

### 4.5 Authentication Configuration

```typescript
export type AuthConfig =
  | BearerTokenAuth
  | ApiKeyAuth
  | BasicAuth
  | OAuth2Auth
  | NoAuth;

export interface BearerTokenAuth {
  type: "bearer";
  /** Static token, or a reference to a secrets store key. */
  token: string;
  /** Header name (default: "Authorization"). */
  header?: string;
  /** Token prefix (default: "Bearer"). */
  prefix?: string;
}

export interface ApiKeyAuth {
  type: "api-key";
  /** The API key value, or a reference to a secrets store key. */
  key: string;
  /** Where to place the key. */
  location: "header" | "query";
  /** Header or query parameter name. */
  name: string;
}

export interface BasicAuth {
  type: "basic";
  username: string;
  password: string;
}

export interface OAuth2Auth {
  type: "oauth2";
  /** OAuth2 grant type. */
  grantType: "client-credentials" | "authorization-code";
  /** Token endpoint URL. */
  tokenUrl: string;
  /** Authorization endpoint URL (for authorization-code). */
  authorizationUrl?: string;
  /** Client ID. */
  clientId: string;
  /** Client secret. */
  clientSecret: string;
  /** Scopes (space-separated). */
  scopes?: string;
  /** Redirect URI (for authorization-code). */
  redirectUri?: string;
  /** JSONPath to access_token in token response. */
  accessTokenPath?: string;
  /** JSONPath to refresh_token in token response. */
  refreshTokenPath?: string;
  /** JSONPath to expires_in in token response. */
  expiresInPath?: string;
}

export interface NoAuth {
  type: "none";
}
```

**Secrets store**: Values prefixed with `$secret:` (e.g. `"$secret:JIRA_API_KEY"`) are resolved from Piper's secure credential store rather than stored in the config file. This prevents tokens from appearing in workspace configs.

---

## 5. Field Mapping & Response Parsing

### 5.1 Entity Field Mappings

```typescript
export interface EntityDefinitions {
  tasks: EntityDefinition;
  projects: EntityDefinition;
  comments?: EntityDefinition;
  people?: EntityDefinition;
}

export interface EntityDefinition {
  /** Maps Piper semantic fields to backend response paths. */
  fields: Record<string, FieldMapping>;
  /** Value transforms for enum-like fields. */
  transforms?: Record<string, ValueTransform>;
}

export interface FieldMapping {
  /**
   * JSONPath or JMESPath expression to extract the field value
   * from the backend response.
   * Examples:
   *   "title"                          — direct field
   *   "fields.System.Title"            — nested dot-notation
   *   "assignee.displayName"           — nested relation
   *   "[0].content"                    — array indexing
   */
  sourcePath: string;

  /** Parser to apply after extraction. */
  parser?: FieldParser;

  /** Default value if source field is missing/null. */
  defaultValue?: unknown;

  /** Whether this field is writable (included in create/update payloads). */
  writable?: boolean;

  /** Whether this field is required for creation. */
  required?: boolean;
}

export type FieldParser =
  | { type: "identity" }
  | { type: "date"; format?: string }
  | { type: "number" }
  | { type: "boolean"; truthy?: unknown[] }
  | { type: "array"; separator?: string }
  | { type: "person"; namePath: string; emailPath: string; avatarPath?: string }
  | { type: "enum"; valueMap: Record<string, string> }
  | { type: "jsonpath"; expression: string }
  | { type: "jmespath"; expression: string }
  | { type: "regex"; pattern: string; group?: number }
  | { type: "custom"; plugin: string };
```

### 5.2 Value Transforms

```typescript
export interface ValueTransform {
  /** Map of backend value → Piper value. */
  mapping: Record<string, string>;
  /** How to handle unmapped values. */
  fallback?: "passthrough" | "default";
  /** Default value for unmapped backend values. */
  defaultValue?: string;
}
```

### 5.3 Write-Direction Mapping (Piper → Backend)

When writing back (create/update), the adapter reverses the field mapping:

```typescript
export interface WriteMapping {
  /** Backend field name to set. */
  targetField: string;
  /** How to serialize the Piper value for the backend. */
  serializer?: "string" | "number" | "iso-date" | "array-comma" | "json";
  /** Reverse enum map (Piper value → backend value). */
  reverseValueMap?: Record<string, string>;
}
```

For REST, mapped fields become the JSON request body. For GraphQL, they become mutation variables.

---

## 6. Generic Adapter Implementation

### 6.1 GenericIssueStore

```typescript
// src/lib/store/generic/generic-issue-store.ts

export class GenericIssueStore implements IssueStore {
  readonly backendId: string;  // from config.id
  readonly capabilities: StoreCapabilities;

  private config: AdapterConfig;
  private httpClient: GenericHttpClient;
  private fieldMapper: GenericFieldMapper;

  constructor(config: AdapterConfig) {
    this.config = config;
    this.backendId = config.id;
    this.capabilities = config.capabilities;
    this.httpClient = new GenericHttpClient(config);
    this.fieldMapper = new GenericFieldMapper(config.entities);
  }

  async initialize(config: BackendConfig): Promise<void> {
    // Validate the AdapterConfig against JSON Schema
    // Resolve $secret: references
    // Warm up caches via refreshAll()
  }

  async listTasks(query: TaskQuery): Promise<PaginatedResult<WorkspaceTask>> {
    const apiConfig = this.config.api;
    if (apiConfig.type === "rest") {
      return this.listRestEntities<WorkspaceTask>("tasks", query);
    } else {
      return this.listGraphQLEntities<WorkspaceTask>("tasks", query);
    }
  }

  // ... delegates all IssueStore methods to generic HTTP + mapping layer
}
```

### 6.2 GenericHttpClient

Encapsulates REST and GraphQL request execution, auth header injection, pagination handling, and error normalization.

```typescript
// src/lib/store/generic/generic-http-client.ts

export class GenericHttpClient {
  constructor(private config: AdapterConfig) {}

  /**
   * Execute a REST request with URL template interpolation,
   * auth header injection, and pagination awareness.
   */
  async restRequest(opts: {
    entity: string;
    operation: "list" | "get" | "create" | "update" | "delete";
    variables: Record<string, string>;
    body?: unknown;
  }): Promise<unknown> { ... }

  /**
   * Execute a GraphQL query/mutation with variable mapping.
   */
  async graphqlRequest(opts: {
    entity: string;
    operation: "list" | "get" | "create" | "update" | "delete";
    variables: Record<string, unknown>;
  }): Promise<unknown> { ... }
}
```

### 6.3 GenericFieldMapper

Handles bidirectional mapping between Piper's domain types and arbitrary JSON shapes.

```typescript
// src/lib/store/generic/generic-field-mapper.ts

export class GenericFieldMapper {
  constructor(private entities: EntityDefinitions) {}

  toTask(rawItem: unknown): WorkspaceTask { ... }
  toProject(rawItem: unknown): WorkspaceProject { ... }
  fromTaskPatch(patch: TaskPatch): Record<string, unknown> { ... }
  fromCreateTask(input: CreateTaskInput): Record<string, unknown> { ... }

  /**
   * Extract a value from a raw JSON object using the configured path
   * and parser for a given Piper semantic field.
   */
  private extractValue(rawItem: unknown, mapping: FieldMapping): unknown { ... }
}
```

### 6.4 GenericAuthProvider

```typescript
// src/lib/store/generic/generic-auth-provider.ts

export class GenericAuthProvider implements AuthProvider {
  readonly backendId: string;
  readonly authType: AuthType;

  private config: AuthConfig;
  private cachedToken?: string;
  private tokenExpiry?: Date;

  async initialize(config: AuthConfig): Promise<void> { ... }
  async getCredential(): Promise<AuthCredential> {
    // Dispatches based on config.type:
    // - "bearer" → { type: "bearer", token }
    // - "api-key" → { type: "api-key", key, header }
    // - "basic" → encoded credentials
    // - "oauth2" → token refresh flow
    // - "none" → { type: "none" }
  }
  async refreshIfNeeded(): Promise<void> { ... }
}
```

### 6.5 GenericAdapterFactory

Implements the existing `BackendFactory` interface, producing all three components from a single `AdapterConfig`.

```typescript
// src/lib/store/generic/generic-adapter-factory.ts

export class GenericAdapterFactory implements BackendFactory {
  constructor(private adapterConfig: AdapterConfig) {}

  createStore(config: BackendConfig): IssueStore {
    return new GenericIssueStore(this.adapterConfig);
  }

  createMapper(config: FieldMappingConfig): SchemaMapper {
    return new GenericSchemaMapper(this.adapterConfig.entities);
  }

  createAuthProvider(config: AuthConfig): AuthProvider {
    return new GenericAuthProvider(this.adapterConfig.auth);
  }
}
```

---

## 7. Registration & Discovery

### 7.1 Config-Driven Registration

The workspace loader discovers `AdapterConfig` files and registers them in the `BackendRegistry`:

```typescript
// In workspace initialization:
const adapterConfig = loadAdapterConfig(workspaceConfig.backend.configPath);
const factory = new GenericAdapterFactory(adapterConfig);
registry.register(adapterConfig.id, factory);
```

### 7.2 Marketplace / Community Configs

Adapter configs can be shared as JSON files. A future marketplace directory structure:

```
adapters/
  trello-v1.json
  asana-v1.json
  notion-issues-v1.json
  youtrack-v1.json
  teamdeck-v1.json
```

Each file is a self-contained `AdapterConfig` that users import into their workspace.

---

## 8. Plugin System

### 8.1 Plugin Interface

```typescript
export interface PiperAdapterPlugin {
  /** Unique plugin identifier. */
  id: string;

  /** Register custom auth handlers. */
  registerAuthHandlers?(registry: AuthHandlerRegistry): void;

  /** Register custom field parsers. */
  registerParsers?(registry: ParserRegistry): void;

  /** Register custom mutation builders. */
  registerMutationBuilders?(registry: MutationBuilderRegistry): void;

  /** Hook: modify a request before it's sent. */
  beforeRequest?(context: RequestContext): Promise<RequestContext>;

  /** Hook: modify a response after it's received. */
  afterResponse?(context: ResponseContext): Promise<ResponseContext>;

  /** Hook: handle errors from the backend. */
  onError?(error: AdapterError): Promise<AdapterError | null>;
}

export interface RequestContext {
  entity: string;
  operation: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: unknown;
}

export interface ResponseContext {
  entity: string;
  operation: string;
  status: number;
  headers: Record<string, string>;
  body: unknown;
}
```

### 8.2 Plugin Loading

```typescript
// In AdapterConfig:
export interface PluginConfig {
  /** Module path or npm package name. */
  module: string;
  /** Plugin-specific options. */
  options?: Record<string, unknown>;
}

// Loading:
for (const plugin of adapterConfig.plugins ?? []) {
  const module = await import(plugin.module);
  const instance: PiperAdapterPlugin = new module.default(plugin.options);
  pluginRegistry.register(instance);
}
```

### 8.3 Built-in Parsers

The `ParserRegistry` ships with built-in parsers for common patterns:

| Parser | Description |
|--------|-------------|
| `identity` | Pass-through, no transformation |
| `date` | Parse string to ISO 8601 date |
| `number` | Coerce to number |
| `boolean` | Configurable truthy values |
| `array` | Split string or pass array |
| `person` | Construct `PersonRef` from nested fields |
| `enum` | Map via value table |
| `jsonpath` | JSONPath extraction from sub-document |
| `jmespath` | JMESPath extraction |

---

## 9. Validation

### 9.1 JSON Schema Validation

Every `AdapterConfig` is validated against a comprehensive JSON Schema at load time:

```
src/lib/store/generic/schemas/adapter-config.schema.json
```

Validation checks:
- Required fields present (`id`, `type`, `api`, `auth`, `entities`, `capabilities`)
- `api.type` is `"rest"` or `"graphql"`
- URL templates contain valid variable references
- `auth.type` is a recognized auth strategy
- Field mappings reference valid Piper semantic fields
- Pagination config is complete for the chosen type
- Capabilities values are within allowed ranges

### 9.2 Runtime Connectivity Check

After schema validation, the adapter performs a lightweight connectivity check:
1. Resolve auth credentials
2. Issue a single GET request to a health-check or list endpoint
3. Verify the response shape matches the configured response paths
4. Report actionable errors (401 = bad auth, 404 = bad URL, etc.)

---

## 10. Security Considerations

| Concern | Mitigation |
|---------|-----------|
| Tokens in config files | `$secret:` references resolve from Piper's credential store, never stored in JSON |
| Arbitrary code via plugins | Plugins must be explicitly listed in config and loaded from approved paths |
| SSRF via malicious baseUrl | Config validation restricts schemes to `https://` (and `http://` for dev) |
| Credential leakage in errors | Auth values are redacted from error messages and logs |

---

## 11. Trade-offs & Decisions

### 11.1 Config vs. Code

**Decision**: Config-first, plugin escape hatch.

**Rationale**: 80%+ of issue trackers expose standard REST CRUD APIs. A JSON config covers them. The 20% with unusual APIs (e.g., multi-step creation, non-standard pagination) use plugins rather than forcing all adapters into code.

### 11.2 JSONPath vs. JMESPath

**Decision**: Support both, default to JSONPath.

**Rationale**: JSONPath is more widely known and has smaller library footprint. JMESPath offers more powerful filtering/projection that some backends need. Both parse the same JSON structures, so supporting both adds minimal complexity.

### 11.3 Separate vs. Unified REST/GraphQL Config

**Decision**: Unified `AdapterConfig` with discriminated union on `api.type`.

**Rationale**: Auth, field mapping, and capabilities are identical regardless of protocol. Only the request/response layer differs. A unified config avoids duplicating shared configuration.

### 11.4 Generic Adapter vs. Per-Backend Code

**Decision**: Concrete adapters (MS Lists, Linear, etc.) remain as-is. Generic adapter is additive.

**Rationale**: Concrete adapters can use backend-specific optimizations (delta links, batch APIs, WebSocket subscriptions) that a generic adapter cannot. The generic adapter targets backends where "good enough" is acceptable.

---

## 12. File Structure

```
src/lib/store/generic/
  index.ts                        # Public exports
  types.ts                        # AdapterConfig and related types
  generic-adapter-factory.ts      # BackendFactory implementation
  generic-issue-store.ts          # IssueStore implementation
  generic-auth-provider.ts        # AuthProvider implementation
  generic-schema-mapper.ts        # SchemaMapper implementation
  generic-http-client.ts          # REST/GraphQL request execution
  generic-field-mapper.ts         # Bidirectional field mapping
  pagination/
    index.ts                      # Pagination strategy dispatcher
    offset-pagination.ts
    cursor-pagination.ts
    link-header-pagination.ts
  parsers/
    index.ts                      # Built-in parser registry
    date-parser.ts
    person-parser.ts
    enum-parser.ts
    jsonpath-parser.ts
    jmespath-parser.ts
  plugins/
    plugin-registry.ts
    types.ts
  schemas/
    adapter-config.schema.json    # JSON Schema for validation
  __tests__/
    generic-issue-store.test.ts
    generic-field-mapper.test.ts
    generic-auth-provider.test.ts
    pagination.test.ts
    parsers.test.ts
    config-validation.test.ts
```

---

## 13. Example: Trello Adapter Config

```json
{
  "id": "trello",
  "label": "Trello",
  "type": "generic",
  "api": {
    "type": "rest",
    "baseUrl": "https://api.trello.com/1",
    "pagination": {
      "type": "offset",
      "offsetParam": "skip",
      "limitParam": "limit",
      "defaultPageSize": 50,
      "maxPageSize": 1000
    },
    "endpoints": {
      "tasks": {
        "list": "/boards/{boardId}/cards?skip={offset}&limit={limit}",
        "get": "/cards/{id}",
        "create": "/cards?idList={listId}",
        "update": "/cards/{id}"
      },
      "projects": {
        "list": "/boards/{boardId}",
        "get": "/boards/{id}",
        "create": "/boards",
        "update": "/boards/{id}"
      }
    }
  },
  "auth": {
    "type": "api-key",
    "key": "$secret:TRELLO_API_KEY",
    "location": "query",
    "name": "key"
  },
  "entities": {
    "tasks": {
      "fields": {
        "id":            { "sourcePath": "id", "parser": { "type": "identity" } },
        "title":         { "sourcePath": "name" },
        "description":   { "sourcePath": "desc" },
        "status":        { "sourcePath": "idList", "parser": { "type": "enum", "valueMap": { "LIST_TODO_ID": "backlog", "LIST_DOING_ID": "in-progress", "LIST_DONE_ID": "done" } } },
        "dueDate":       { "sourcePath": "due", "parser": { "type": "date" } },
        "assigneeId":    { "sourcePath": "idMembers[0]" },
        "labels":        { "sourcePath": "labels[*].name", "parser": { "type": "array" } }
      }
    },
    "projects": {
      "fields": {
        "id":            { "sourcePath": "id" },
        "title":         { "sourcePath": "name" },
        "description":   { "sourcePath": "desc" }
      }
    }
  },
  "capabilities": {
    "supportsOffline": false,
    "supportsDeltaQuery": false,
    "supportsWebhooks": true,
    "supportsBatchOperations": false,
    "supportsRichText": true,
    "supportsHierarchy": false,
    "maxPageSize": 1000,
    "writeLatency": "immediate"
  }
}
```

---

## 14. Example: Notion Adapter Config (GraphQL)

```json
{
  "id": "notion",
  "label": "Notion",
  "type": "generic",
  "api": {
    "type": "rest",
    "baseUrl": "https://api.notion.com/v1",
    "defaultHeaders": {
      "Notion-Version": "2022-06-28"
    },
    "pagination": {
      "type": "cursor",
      "cursorParam": "start_cursor",
      "limitParam": "page_size",
      "nextCursorPath": "next_cursor",
      "hasMorePath": "has_more",
      "defaultPageSize": 100
    },
    "endpoints": {
      "tasks": {
        "list": "/databases/{databaseId}/query",
        "create": "/pages",
        "update": "/pages/{id}",
        "get": "/pages/{id}"
      }
    }
  },
  "auth": {
    "type": "bearer",
    "token": "$secret:NOTION_INTEGRATION_TOKEN"
  },
  "entities": {
    "tasks": {
      "fields": {
        "id":          { "sourcePath": "id" },
        "title":       { "sourcePath": "properties.Name.title[0].plain_text", "parser": { "type": "jmespath", "expression": "properties.Name.title[0].plain_text" } },
        "status":      { "sourcePath": "properties.Status.status.name", "parser": { "type": "enum", "valueMap": { "To Do": "backlog", "In Progress": "in-progress", "Done": "done" } } },
        "priority":    { "sourcePath": "properties.Priority.select.name", "parser": { "type": "enum", "valueMap": { "High": "high", "Medium": "medium", "Low": "low" } } },
        "dueDate":     { "sourcePath": "properties.Due.date.start", "parser": { "type": "date" } },
        "assigneeId":  { "sourcePath": "properties.Assignee.people[0].id" }
      }
    }
  },
  "capabilities": {
    "supportsOffline": false,
    "supportsDeltaQuery": false,
    "supportsWebhooks": true,
    "supportsBatchOperations": false,
    "supportsRichText": true,
    "supportsHierarchy": true,
    "maxPageSize": 100,
    "writeLatency": "immediate"
  }
}
```

---

## 15. Migration Path

1. **Phase A** — Implement `GenericIssueStore`, `GenericFieldMapper`, `GenericHttpClient`, and `GenericAuthProvider`. Register via `GenericAdapterFactory` in the existing `BackendRegistry`.
2. **Phase B** — Add JSON Schema validation and the `$secret:` credential store integration.
3. **Phase C** — Build the plugin system and parser registry.
4. **Phase D** — Create adapter configs for 2-3 popular trackers (Trello, Notion) as reference implementations.
5. **Phase E** — Build UI for the field mapping wizard (drag-and-drop config builder).

---

## 16. Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Generic adapter too slow for large datasets | Medium | Medium | Generic adapter uses the same caching pattern as concrete adapters; pagination is config-driven |
| JSONPath/JMESPath library size | Low | Low | Both libraries are <20KB gzipped; bundled conditionally |
| Config complexity overwhelms users | Medium | High | Provide a UI wizard (Phase E) and pre-built marketplace configs |
| Plugin security sandboxing | Low | High | Plugins run in main thread with explicit config opt-in; future: worker sandbox |
| API version drift | High | Low | Config declares expected response shape; validation catches breaking changes at load time |

---

## 17. Success Criteria

- [ ] A single JSON config connects Piper to any REST or GraphQL API without code
- [ ] Existing concrete adapters work unchanged (zero regressions)
- [ ] Config validation catches >90% of misconfiguration before any API call
- [ ] Generic adapter passes the same test suite as concrete adapters (via shared `IssueStore` contract tests)
- [ ] At least 2 reference configs (Trello, Notion) validated end-to-end
