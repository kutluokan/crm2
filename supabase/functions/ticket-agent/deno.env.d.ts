/// <reference no-default-lib="true" />
/// <reference lib="deno.ns" />
/// <reference lib="deno.window" />
/// <reference lib="esnext" />
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/// <reference lib="dom.asynciterable" />

declare module "https://deno.land/std@0.140.0/http/server.ts" {
  export interface ServeInit {
    port?: number;
    hostname?: string;
    handler?: (request: Request) => Response | Promise<Response>;
    onError?: (error: unknown) => Response | Promise<Response>;
  }

  export type Handler = (request: Request) => Response | Promise<Response>;
  
  export function serve(handler: Handler, init?: ServeInit): void;
  export function serve(init: ServeInit): void;
}

declare module "@supabase/supabase-js" {
  export interface SupabaseClientOptions {
    auth?: {
      autoRefreshToken?: boolean;
      persistSession?: boolean;
      detectSessionInUrl?: boolean;
    };
  }

  export interface SupabaseClient {
    from: (table: string) => any;
    rpc: (fn: string, args?: any) => any;
  }

  export function createClient(
    supabaseUrl: string,
    supabaseKey: string,
    options?: SupabaseClientOptions
  ): SupabaseClient;
}

declare module "openai" {
  export interface OpenAIOptions {
    apiKey?: string;
  }

  export class OpenAI {
    constructor(options?: OpenAIOptions);
    chat: {
      completions: {
        create: (options: any) => Promise<any>;
      };
    };
    embeddings: {
      create: (options: any) => Promise<any>;
    };
  }
}

declare global {
  const Deno: {
    env: {
      get(key: string): string | undefined;
      set(key: string, value: string): void;
      delete(key: string): void;
      toObject(): { [key: string]: string };
    };
  };
}

declare interface Window {
  Deno: typeof Deno;
} 