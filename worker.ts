import { Hono } from "hono";
import { cors } from "hono/cors";
import { bearerAuth } from "hono/bearer-auth";
import { DurableObject } from 'cloudflare:workers'
import adminHTML from "./admin.html";

export class FlagStore extends DurableObject<Cloudflare.Env> {
  state: DurableObjectState;
  app = new Hono();
  flags: Record<string, boolean> = {};
  sessions = new Set<WebSocket>();

  constructor(state: DurableObjectState, env: Cloudflare.Env) {
    super(state, env)
    this.state = state;
    this.state.blockConcurrencyWhile(async () => {
      this.flags = (await this.state.storage?.get("flags")) || {};
    });

    const token = env.API_TOKEN || "dev-token-change-in-production";

    this.app.use("/api/*", cors());
    this.app.use("/admin/*", bearerAuth({ token }));

    this.app.get("/", (c) => c.html(adminHTML));

    this.app.get("/ws", async (c) => {
      if (c.req.header("Upgrade") !== "websocket") {
        return c.text("Expected WebSocket", 426);
      }
      const [client, server] = Object.values(new WebSocketPair());
      this.sessions.add(server);
      server.addEventListener("close", () => this.sessions.delete(server));
      server.accept();
      return new Response(null, { status: 101, webSocket: client });
    });

    this.app.get("/api/flags", (c) => c.json(this.flags));

    this.app.get("/api/flags/:key", async (c) => {
      return c.json({ value: this.flags[c.req.param("key")] ?? false });
    });

    this.app.get("/admin/flags", (c) => c.json(this.flags));

    this.app.put("/admin/flags/:key", async (c) => {
      const { value } = await c.req.json();
      this.flags[c.req.param("key")] = value;
      await this.state.storage?.put("flags", this.flags);

      const msg = JSON.stringify({
        type: "update",
        key: c.req.param("key"),
        value,
      });
      this.sessions.forEach((ws) => {
        try {
          ws.send(msg);
        } catch {
          this.sessions.delete(ws);
        }
      });

      return c.json({ success: true });
    });

    this.app.delete("/admin/flags/:key", async (c) => {
      delete this.flags[c.req.param("key")];
      await this.state.storage?.put("flags", this.flags);

      const msg = JSON.stringify({ type: "delete", key: c.req.param("key") });
      this.sessions.forEach((ws) => {
        try {
          ws.send(msg);
        } catch {
          this.sessions.delete(ws);
        }
      });

      return c.json({ success: true });
    });
  }

  async fetch(request: Request) {
    return this.app.fetch(request);
  }
}

export default {
  async fetch(request: Request, env: Cloudflare.Env) {
    const id = env.FLAGS.idFromName("global");
    const store = env.FLAGS.get(id);
    return store.fetch(request);
  },
};
