import { setInterval } from 'node:timers';
import type { NodeOptions } from 'crossws/adapters/node';
import { relay } from '../utils/relay';

export default defineNitroPlugin(nitroApp => {
  // Cap messages at 8 KiB (ws defaults to 100 MiB!). Nitro's node server hands
  // h3App.websocket to crossws' node adapter, which passes `serverOptions` to the ws WebSocketServer.
  // h3 builds h3App.websocket from options.websocket on first read, and Nitro reads it only after
  // every plugin ran. A too big message makes ws close that socket (1009); crossws listens for the
  // error, so it doesn't crash the server.
  const websocket: NodeOptions = { ...nitroApp.h3App.options.websocket, serverOptions: { maxPayload: 8 * 1024 } };
  nitroApp.h3App.options.websocket = websocket;

  setInterval(relay.heartbeat, 30_000).unref();
});
