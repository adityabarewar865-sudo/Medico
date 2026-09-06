import type { Response } from 'express';

interface SSEClient {
  id: string;
  res: Response;
}

class SSEService {
  private clients: SSEClient[] = [];

  public addClient(res: Response): string {
    const id = `client_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    
    // Set standard SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', clientId: id, timestamp: new Date().toISOString() })}\n\n`);

    const client: SSEClient = { id, res };
    this.clients.push(client);

    res.on('close', () => {
      this.removeClient(id);
    });

    return id;
  }

  public removeClient(id: string): void {
    this.clients = this.clients.filter((c) => c.id !== id);
  }

  public broadcast(eventType: string, payload: unknown): void {
    const message = `event: ${eventType}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const client of this.clients) {
      try {
        client.res.write(message);
      } catch (err) {
        console.error(`Failed to send SSE event to client ${client.id}:`, err);
      }
    }
  }

  public getActiveClientCount(): number {
    return this.clients.length;
  }
}

export const sse = new SSEService();
