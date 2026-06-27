import type { NextRequest } from 'next/server';

export type RouteHandler = (req: NextRequest, ctx: HandlerContext) => Promise<Response> | Response;

export type HandlerContext = {
  params?: Promise<Record<string, string | string[] | undefined>>;
  publicKey?: string;
  [k: string]: unknown;
};

export type Middleware = (handler: RouteHandler) => RouteHandler;

export function compose(...middlewares: Middleware[]) {
  // biome-ignore lint/suspicious/noExplicitAny: route ctx shape is provided by Next.
  return (
    handler: RouteHandler,
  ): ((req: NextRequest, ctx: any) => Promise<Response> | Response) => {
    const composed = middlewares.reduceRight((acc, mw) => mw(acc), handler);
    // biome-ignore lint/suspicious/noExplicitAny: route ctx shape is provided by Next.
    return (req: NextRequest, ctx: any) => composed(req, ctx as HandlerContext);
  };
}
