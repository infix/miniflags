# miniflags

Feature flags on Cloudflare Workers. 200[^1] lines total.

## Deploy

```bash
npm install
wrangler deploy
wrangler secret put API_TOKEN
```

## Client

```javascript
import { FeatureFlags } from "./client";

const flags = new FeatureFlags("https://your-worker.workers.dev");

if (flags.get("new-feature")) {
  // feature enabled
}
```

## Admin

Visit worker URL. Enter token. Toggle flags.

## API

```bash
GET /api/flags
GET /api/flags/:key
PUT /admin/flags/:key    # Bearer token required
DELETE /admin/flags/:key # Bearer token required
```

## Configuration

```toml
# wrangler.toml
name = "miniflags"
main = "worker.ts"

[[durable_objects.bindings]]
name = "FLAGS"
class_name = "FlagStore"

[[migrations]]
tag = "v1"
new_classes = ["FlagStore"]
```

## Architecture

- Durable Object stores flags
- WebSocket broadcasts changes
- Client caches locally
- No database required

## Costs

Workers free tier covers 100K requests/day. Durable Objects free tier covers 1M requests/month.

## License

MIT

[^1]: ~223 from `wc -l worker.ts client.ts admin.html`
