export class FeatureFlags {
  private cache: Record<string, boolean> = {};
  private ws?: WebSocket;

  constructor(private url: string) {
    this.connect();
    this.poll();
  }

  private connect() {
    this.ws = new WebSocket(this.url.replace("http", "ws") + "/ws");
    this.ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === "update") {
        this.cache[data.key] = data.value;
      } else if (data.type === "delete") {
        delete this.cache[data.key];
      }
    };
    this.ws.onclose = () => setTimeout(() => this.connect(), 5000);
  }

  private async poll() {
    try {
      const res = await fetch(`${this.url}/api/flags`);
      const data = await res.json();
      Object.entries(data).forEach(([k, v]) => {
        this.cache[k] = v as boolean;
      });
    } catch {}
  }

  get(key: string): boolean {
    return this.cache[key] ?? false;
  }

  async refresh(): Promise<void> {
    await this.poll();
  }

  destroy() {
    this.ws?.close();
  }
}
