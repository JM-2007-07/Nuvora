import {
  Body,
  type CanActivate,
  Controller,
  createParamDecorator,
  type ExecutionContext,
  Get,
  HttpCode,
  Inject,
  Injectable,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  type CommsOverview,
  type Message,
  type MessagesPage,
  MessagesQuerySchema,
  OpenDirectRequestSchema,
  SendTextRequestSchema,
  VOICE_MAX_BYTES,
} from '@nuvora/shared';
import type { Request, Response } from 'express';
import type { z } from 'zod';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe.js';
import { CommsService } from './comms.service.js';
import { CommsDirectory, type CommsParticipant } from './directory.js';

const meByRequest = new WeakMap<Request, CommsParticipant>();

/** Learner or teacher from the session cookie (or `Authorization: Bearer <signed value>` on mobile). Centers get 403. */
@Injectable()
export class CommsGuard implements CanActivate {
  constructor(@Inject(CommsDirectory) private readonly directory: CommsDirectory) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const auth = request.headers.authorization;
    const me = auth?.startsWith('Bearer ') ? await this.directory.fromToken(auth.slice(7)) : await this.directory.fromCookieHeader(request.headers.cookie);
    if (!me) throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Sign in to use messages and calls' });
    meByRequest.set(request, me);
    return true;
  }
}

const Me = createParamDecorator((_data: unknown, context: ExecutionContext): CommsParticipant => {
  const me = meByRequest.get(context.switchToHttp().getRequest<Request>());
  if (!me) throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'No session' });
  return me;
});

/** Uploaded file as multer gives it (memory storage). */
interface UploadedAudio {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

@Controller('comms')
@UseGuards(CommsGuard)
export class CommsController {
  constructor(@Inject(CommsService) private readonly comms: CommsService) {}

  @Get()
  overview(@Me() me: CommsParticipant): Promise<CommsOverview> {
    return this.comms.overview(me);
  }

  @Post('direct')
  @HttpCode(200)
  openDirect(@Me() me: CommsParticipant, @Body(new ZodValidationPipe(OpenDirectRequestSchema)) body: z.infer<typeof OpenDirectRequestSchema>): Promise<{ id: string }> {
    return this.comms.openDirect(me, body.participantKey);
  }

  @Get('conversations/:id/messages')
  messages(@Me() me: CommsParticipant, @Param('id') id: string, @Query(new ZodValidationPipe(MessagesQuerySchema)) query: z.infer<typeof MessagesQuerySchema>): Promise<MessagesPage> {
    return this.comms.messages(me, id, query.before, query.limit);
  }

  @Post('conversations/:id/messages')
  sendText(@Me() me: CommsParticipant, @Param('id') id: string, @Body(new ZodValidationPipe(SendTextRequestSchema)) body: z.infer<typeof SendTextRequestSchema>): Promise<Message> {
    return this.comms.sendText(me, id, body.text);
  }

  @Post('conversations/:id/voice')
  @UseInterceptors(FileInterceptor('audio', { limits: { fileSize: VOICE_MAX_BYTES, files: 1 } }))
  sendVoice(@Me() me: CommsParticipant, @Param('id') id: string, @UploadedFile() file: UploadedAudio | undefined, @Body('durationMs') durationMs: string): Promise<Message> {
    return this.comms.sendVoice(me, id, file, Number(durationMs));
  }

  @Get('messages/:id/voice')
  async voice(@Me() me: CommsParticipant, @Param('id') id: string, @Res({ passthrough: true }) res: Response): Promise<StreamableFile> {
    const clip = await this.comms.voice(me, id);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return new StreamableFile(Buffer.from(clip.data), { type: clip.mimeType, length: clip.data.byteLength });
  }

  @Post('conversations/:id/read')
  @HttpCode(204)
  read(@Me() me: CommsParticipant, @Param('id') id: string): Promise<void> {
    return this.comms.markRead(me, id);
  }
}
