import type { ApiEnv } from "./api/routes";
import api from "./api/routes";
import type { EmailHandlerEnv } from "./email-handler";
import { handleEmail } from "./email-handler";

/**
 * BlipMail - Disposable Temp Mail on Cloudflare Workers
 *
 * Handles:
 * - fetch()  → API routes (static files served via Cloudflare Assets)
 * - email()  → inbound email processing via Cloudflare Email Worker
 */

// Combined env bindings
export interface Env extends ApiEnv, EmailHandlerEnv {
  ASSETS: Fetcher;
}

export default {
  /**
   * HTTP fetch handler - serves API routes.
   * Static files (src/web/) are served via Cloudflare [assets].
   */
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);

    // Route /api/* to Hono router (strip /api prefix)
    if (url.pathname.startsWith("/api/")) {
      const apiUrl = new URL(request.url);
      apiUrl.pathname = url.pathname.slice(4); // strip '/api'
      const apiRequest = new Request(apiUrl, request);
      return api.fetch(apiRequest, env, ctx);
    }

    // Pretty URL for the API docs page
    if (url.pathname === "/docs" || url.pathname === "/docs/") {
      const docsUrl = new URL(request.url);
      docsUrl.pathname = "/docs.html";
      return env.ASSETS.fetch(new Request(docsUrl, request));
    }

    // Everything else falls through to static assets
    return env.ASSETS.fetch(request);
  },

  /**
   * Email handler - called by Cloudflare for every inbound email
   * at any @<MAIL_DOMAIN> address.
   */
  async email(
    message: ForwardableEmailMessage,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<void> {
    await handleEmail(message, env);
  },
};
