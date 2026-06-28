/**
 * Generates the TypeScript HTTP client class for the SDK.
 */

import type { ParsedSpec } from "../../types";

/**
 * Generate the client class source code.
 *
 * @param spec - The parsed OpenAPI spec
 * @returns TypeScript source code string for the client module
 */
export function generateClient(spec: ParsedSpec): string {
  const baseUrl = spec.servers[0] || "http://localhost:3000";
  const title = spec.info.title || "API";

  return `// Auto-generated ${title} Client
// Do not edit manually

import { EmitError, EmitHttpError } from "./errors";

export interface ClientOptions {
  baseUrl?: string;
  token?: string;
  headers?: Record<string, string>;
}

export class Client {
  private baseUrl: string;
  private token?: string;
  private headers: Record<string, string>;

  constructor(options: ClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? "${baseUrl}";
    this.token = options.token;
    this.headers = options.headers ?? {};
  }

  /**
   * Set the authentication token.
   */
  setToken(token: string): void {
    this.token = token;
  }

  /**
   * Set the base URL.
   */
  setBaseUrl(baseUrl: string): void {
    this.baseUrl = baseUrl;
  }

  private buildHeaders(contentType?: string): Record<string, string> {
    const headers: Record<string, string> = {
      ...this.headers,
    };

    if (contentType) {
      headers["Content-Type"] = contentType;
    }

    if (this.token) {
      headers["Authorization"] = \`Bearer \${this.token}\`;
    }

    return headers;
  }

  private buildUrl(path: string, params?: Record<string, string>): string {
    let url = \`\${this.baseUrl}\${path}\`;
    if (params) {
      const searchParams = new URLSearchParams(params);
      const qs = searchParams.toString();
      if (qs) {
        url += \`?\${qs}\`;
      }
    }
    return url;
  }

  private async request<T>(
    method: string,
    path: string,
    options: {
      body?: unknown;
      params?: Record<string, string>;
      headers?: Record<string, string>;
    } = {}
  ): Promise<T> {
    const url = this.buildUrl(path, options.params);
    const headers = {
      ...this.buildHeaders(options.body ? "application/json" : undefined),
      ...options.headers,
    };

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
    } catch (error: any) {
      throw new EmitError(\`Network error: \${error.message}\`);
    }

    if (!response.ok) {
      let errorBody: unknown;
      try {
        errorBody = await response.json();
      } catch {
        errorBody = await response.text().catch(() => null);
      }
      throw new EmitHttpError(
        \`HTTP \${response.status}: \${response.statusText}\`,
        response.status,
        errorBody
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  async get<T>(path: string, params?: Record<string, string>, headers?: Record<string, string>): Promise<T> {
    return this.request<T>("GET", path, { params, headers });
  }

  async post<T>(path: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
    return this.request<T>("POST", path, { body, headers });
  }

  async put<T>(path: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
    return this.request<T>("PUT", path, { body, headers });
  }

  async patch<T>(path: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
    return this.request<T>("PATCH", path, { body, headers });
  }

  async delete<T>(path: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>("DELETE", path, { headers });
  }
}
`;
}
