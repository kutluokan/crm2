declare module "https://deno.land/std@0.140.0/http/server.ts" {
  export function serve(handler: (req: Request) => Promise<Response>): void;
} 