import { spawn } from 'node:child_process';
import dns from 'node:dns/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { port, setPublicUrl } from '../utils/network';
import { relay } from '../utils/relay';

// A fresh quick-tunnel hostname needs a few seconds to exist in DNS. Phones that look it up too early
// get "not found", and some resolvers cache that for minutes. So only show it once trycloudflare.com's
// own nameservers answer (they never cache). Gives up after ~30 s (e.g. outside DNS blocked) and shows it anyway.
async function dnsReady(host: string) {
  const end = Date.now() + 30_000;
  try {
    const auth = new dns.Resolver({ timeout: 1000, tries: 1 });
    auth.setServers(await Promise.all((await dns.resolveNs('trycloudflare.com')).map(async ns => (await dns.lookup(ns, { family: 4 })).address)));
    while (Date.now() < end) {
      try {
        return await auth.resolve4(host);
      } catch {
        await sleep(1000);
      }
    }
  } catch {} // no DNS at all: don't block
}

// `npm run tunnel` (TUNNEL=1): TryCloudflare quick tunnel, so phones can join over https from any network.
export default defineNitroPlugin(nitroApp => {
  if (!process.env.TUNNEL || import.meta.dev) return;
  console.log('  🌍 Starting Cloudflare quick tunnel…');
  const cf = spawn('cloudflared', ['tunnel', '--no-autoupdate', '--url', `http://localhost:${port}`], { stdio: ['ignore', 'pipe', 'pipe'] });
  const usePublicUrl = (url?: string) => {
    setPublicUrl(url);
    relay.refresh();
  };
  let seen: string | undefined;
  const watch = async (chunk: Buffer) => {
    const url = String(chunk).match(/https:\/\/(?!api\.)[-a-z0-9]+\.trycloudflare\.com/)?.[0];
    if (!url || url === seen) return;
    seen = url;
    await dnsReady(new URL(url).hostname);
    if (seen !== url) return;
    usePublicUrl(url);
    console.log(`  🌍 Phones join via ${url} (any network)\n`);
  };
  cf.stdout.on('data', watch);
  cf.stderr.on('data', watch);
  cf.on('error', () => console.log('  ❌ cloudflared not found. Install it (Arch: sudo pacman -S cloudflared), see https://try.cloudflare.com'));
  cf.on('exit', code => {
    seen = undefined;
    if (code !== null) console.log(`  ⚠️  cloudflared stopped (${code}); phones need the local Wi-Fi again`);
    usePublicUrl();
  });
  // Nitro's graceful shutdown owns SIGINT/SIGTERM (and ends in process.exit), so no signal handlers here:
  // stop cloudflared when Nitro closes, and on any other way out.
  const stop = () => cf.kill();
  nitroApp.hooks.hook('close', stop);
  process.on('exit', stop);
});
