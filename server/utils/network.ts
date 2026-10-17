import os from 'node:os';

export const port = process.env.NITRO_PORT || process.env.PORT || 3000;
const PUBLIC_URL = process.env.PUBLIC_URL?.replace(/\/$/, ''); // e.g. a named Cloudflare tunnel

// First real LAN address; skips docker/VM bridges. Override with HOST_IP=... if it picks wrong.
export function lanIp(): string {
  if (process.env.HOST_IP) return process.env.HOST_IP;
  for (const [name, addrs] of Object.entries(os.networkInterfaces()))
    if (!/^(docker|br-|veth|virbr|vmnet|vboxnet|tailscale|lo)/.test(name))
      for (const a of addrs ?? []) if (a.family === 'IPv4' && !a.internal) return a.address;
  return 'localhost';
}

// Where phones join: a tunnel/public URL if we have one, else this machine on the LAN.
export let publicUrl = PUBLIC_URL;
/** No url: back to PUBLIC_URL (or the LAN). Call relay.refresh() after it so screens show the new QR code. */
export const setPublicUrl = (url = PUBLIC_URL) => {
  publicUrl = url;
};
export const joinUrl = (code: string) => `${publicUrl || `http://${lanIp()}:${port}`}/${code}`;
