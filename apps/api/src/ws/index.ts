import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { Server } from 'http';
import { prisma } from '../lib/prisma';
import { AgentStateMachine } from '../agent/agentStateMachine';

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const ticket = url.searchParams.get('ticket');
    console.log('[ws] new connection, ticket:', ticket);
    if (!ticket) { ws.close(4001, 'missing_ticket'); return; }
    const call = await prisma.call.findUnique({ where: { wsTicket: ticket } }).catch(() => null);
    if (!call) { ws.close(4002, 'invalid_ticket'); return; }
    const room = new AgentStateMachine(ws, call.id, call.sessionId);
    await room.start();
    ws.on('message', async (raw, isBinary) => {
      try {
        if (isBinary) {
          // Raw binary audio - treat as audio chunk directly
          console.log('[ws] received binary frame, size:', (raw as Buffer).length);
          await room.handleAudio(raw as Buffer, 'audio/l16');
          return;
        }
        const msg = JSON.parse(raw.toString());
        const type = msg.type || msg.event;
        console.log('[ws] received:', type);
        if (type === 'audio_chunk' || type === 'audio_data') {
          const buffer = Buffer.from(msg.data, 'base64');
          await room.handleAudio(buffer, msg.mimeType || 'audio/l16');
        } else if (type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        } else if (type === 'hangup') {
          await room.end();
        } else if (type === 'style_change') {
          room.setStyle(msg.style);
        } else if (type === 'prefer_silence') {
          room.setStyle('quiet');
        } else if (type === 'speech_end') {
          await room.handleSpeechEnd();
        } else if (type === 'speech_start') {
          console.log('[ws] speech start');
        }
      } catch (err) {
        console.error('[ws] message handler error:', err);
      }
    });
    ws.on('close', async () => {
      console.log('[ws] connection closed');
      await room.end().catch(() => {});
    });
  });
}
