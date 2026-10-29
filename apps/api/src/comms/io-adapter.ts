import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { COMMS_SOCKET_PATH } from '@nuvora/shared';
import type { Server, ServerOptions } from 'socket.io';

/** Local web origins (dev server, production preview on another port) may connect with cookies. */
export function allowedOrigin(origin: string | undefined, webOrigin: string): boolean {
  if (!origin) return true; // native apps send no Origin; they authenticate with a token
  return origin === webOrigin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

/**
 * Socket.IO on the API's own HTTP server, at /realtime. The browser connects to the API
 * directly (the session cookie is sent: same site, another port), so CORS allows the web origins.
 */
export class CommsIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly webOrigin: string,
  ) {
    super(app);
  }

  override createIOServer(port: number, options?: ServerOptions): Server {
    return super.createIOServer(port, {
      ...options,
      path: COMMS_SOCKET_PATH,
      maxHttpBufferSize: 512 * 1024,
      cors: { origin: (origin: string | undefined, done: (err: Error | null, allow?: boolean) => void) => done(null, allowedOrigin(origin, this.webOrigin)), credentials: true },
    } as ServerOptions) as Server;
  }
}
