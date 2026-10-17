// WS_PATH (/ws): the room relay. Logic and the shared instance live in server/utils/relay.ts.
import { relay } from '../utils/relay';

export default defineWebSocketHandler(relay.hooks);
