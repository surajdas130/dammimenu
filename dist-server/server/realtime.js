class RealtimeHub {
    clients = new Set();
    addClient(res) {
        this.clients.add(res);
        return () => {
            this.clients.delete(res);
        };
    }
    broadcast(event) {
        const payload = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
        for (const client of this.clients) {
            if (!client.writableEnded) {
                client.write(payload);
            }
            else {
                this.clients.delete(client);
            }
        }
    }
    getClientCount() {
        return this.clients.size;
    }
}
export const realtimeHub = new RealtimeHub();
