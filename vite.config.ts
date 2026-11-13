import { defineConfig, Plugin } from 'vite';
import { WebSocketServer, WebSocket } from 'ws';

function multiplayerWsPlugin(): Plugin {
  return {
    name: 'multiplayer-relay',
    configureServer(server) {
      if (!server.httpServer) return;

      const wss = new WebSocketServer({
        noServer: true
      });

      const rooms = new Map<string, Set<WebSocket>>();

      server.httpServer.on('upgrade', (req, socket, head) => {
        const url = new URL(req.url || '', `http://${req.headers.host}`);
        if (url.pathname === '/api/multiplayer') {
          wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit('connection', ws, req);
          });
        }
      });

      wss.on('connection', (ws) => {
        let clientRoomId: string | null = null;

        ws.on('message', (raw) => {
          try {
            const data = JSON.parse(raw.toString());

            if (data.type === 'JOIN_ROOM') {
              clientRoomId = data.roomId;
              if (!rooms.has(clientRoomId!)) {
                rooms.set(clientRoomId!, new Set());
              }
              rooms.get(clientRoomId!)!.add(ws);

              // Broadcast to existing room members that new player connected
              for (const peer of rooms.get(clientRoomId!)!) {
                if (peer !== ws && peer.readyState === WebSocket.OPEN) {
                  peer.send(JSON.stringify(data));
                }
              }
            } else if (clientRoomId && rooms.has(clientRoomId)) {
              // Relay message to all other peers in the same room
              const roomPeers = rooms.get(clientRoomId);
              if (roomPeers) {
                for (const peer of roomPeers) {
                  if (peer !== ws && peer.readyState === WebSocket.OPEN) {
                    peer.send(JSON.stringify(data));
                  }
                }
              }
            }
          } catch (e) {
            console.error('WS Message parsing error:', e);
          }
        });

        ws.on('close', () => {
          if (clientRoomId && rooms.has(clientRoomId)) {
            const roomPeers = rooms.get(clientRoomId);
            if (roomPeers) {
              roomPeers.delete(ws);
              if (roomPeers.size === 0) {
                rooms.delete(clientRoomId);
              } else {
                for (const peer of roomPeers) {
                  if (peer.readyState === WebSocket.OPEN) {
                    peer.send(JSON.stringify({ type: 'PEER_DISCONNECTED' }));
                  }
                }
              }
            }
          }
        });
      });
    }
  };
}

export default defineConfig({
  plugins: [multiplayerWsPlugin()],
  server: {
    port: 3000,
    open: false,
    host: true
  },
  build: {
    target: 'esnext',
    sourcemap: true,
    chunkSizeWarningLimit: 1500
  }
});
