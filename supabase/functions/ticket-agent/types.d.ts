declare module "https://deno.land/std@0.140.0/http/server.ts" {
  export function serve(handler: (req: Request) => Promise<Response>): void;
}

declare module "@supabase/supabase-js" {
  export * from "@supabase/supabase-js";
}

declare module "@langchain/openai" {
  export * from "@langchain/openai";
}

declare module "langchain/agents" {
  export * from "langchain/agents";
}

declare module "@langchain/core/prompts" {
  export * from "@langchain/core/prompts";
}

declare module "@langchain/core/tools" {
  export * from "@langchain/core/tools";
}

declare module "langsmith" {
  export class Client {
    constructor(config?: any);
  }
}

declare module "zod" {
  export * from "zod";
}

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
}; 