import { lanIp, port, publicUrl } from '../utils/network';

export default defineNitroPlugin(() => {
  console.log(`\n  📻 JOTA-JOTI Games\n  Big screen: http://localhost:${port}\n  Phones join via QR code on the big screen (${publicUrl || lanIp()})\n`);
});
