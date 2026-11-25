import type { Response } from 'express';
import type { RealtimeEvent } from '../shared/types.js';

class RealtimeHub {
  private clients = new Set<Response>();

  addClient(res: Response): () => void {
    this.clients.add(res);
    return () => {
      this.clients.delete(res);
    };
  }

  broadcast(event: RealtimeEvent): void {
    const payload = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
    for (const client of this.clients) {
      if (!client.writableEnded) {
        client.write(payload);
      } else {
        this.clients.delete(client);
      }
    }
  }

  getClientCount(): number {
    return this.clients.size;
  }
}

export const realtimeHub = new RealtimeHub();
