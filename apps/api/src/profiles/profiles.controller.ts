import {
  Body,
  type CanActivate,
  Controller,
  createParamDecorator,
  Delete,
  type ExecutionContext,
  Get,
  Inject,
  Injectable,
  Param,
  Put,
  Query,
  Res,
  StreamableFile,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { HandleSchema, type MyProfile, PROFILE_AVATAR_MAX_BYTES, type ProfileSettings, ProfileSettingsSchema, type PublicProfile } from '@nuvora/shared';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe.js';
import { type ProfilePerson, ProfilesService } from './profiles.service.js';

const personByRequest = new WeakMap<Request, ProfilePerson>();

/** Any signed-in person (learner, guest, any staff role); 401 without a session. */
@Injectable()
export class ProfileGuard implements CanActivate {
  constructor(@Inject(ProfilesService) private readonly profiles: ProfilesService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const person = await this.profiles.fromCookieHeader(request.headers.cookie);
    if (!person) throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Sign in to see profiles' });
    personByRequest.set(request, person);
    return true;
  }
}

const Me = createParamDecorator((_data: unknown, context: ExecutionContext): ProfilePerson => {
  const person = personByRequest.get(context.switchToHttp().getRequest<Request>());
  if (!person) throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'No session' });
  return person;
});

const HandleQuerySchema = z.strictObject({ handle: HandleSchema });

@Controller()
@UseGuards(ProfileGuard)
export class ProfilesController {
  constructor(@Inject(ProfilesService) private readonly profiles: ProfilesService) {}

  @Get('me/profile')
  mine(@Me() me: ProfilePerson): Promise<MyProfile> {
    return this.profiles.mine(me);
  }

  @Put('me/profile')
  save(@Me() me: ProfilePerson, @Body(new ZodValidationPipe(ProfileSettingsSchema)) body: ProfileSettings): Promise<MyProfile> {
    return this.profiles.save(me, body);
  }

  @Get('me/profile/handle-available')
  async available(@Me() me: ProfilePerson, @Query(new ZodValidationPipe(HandleQuerySchema)) query: z.infer<typeof HandleQuerySchema>): Promise<{ available: boolean }> {
    return { available: await this.profiles.handleAvailable(me, query.handle) };
  }

  @Put('me/profile/avatar')
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: PROFILE_AVATAR_MAX_BYTES, files: 1 } }))
  setAvatar(@Me() me: ProfilePerson, @UploadedFile() file: { buffer: Buffer; mimetype: string; size: number } | undefined): Promise<MyProfile> {
    return this.profiles.setAvatar(me, file);
  }

  @Delete('me/profile/avatar')
  removeAvatar(@Me() me: ProfilePerson): Promise<MyProfile> {
    return this.profiles.removeAvatar(me);
  }

  @Get('profiles/avatar/:key')
  async avatar(@Param('key') key: string, @Res({ passthrough: true }) res: Response): Promise<StreamableFile> {
    const photo = await this.profiles.avatar(key);
    // The URL carries ?v=<updatedAt>, so a long private cache is safe.
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    return new StreamableFile(Buffer.from(photo.data), { type: photo.mimeType, length: photo.data.byteLength });
  }

  @Get('profiles/:ref')
  view(@Me() me: ProfilePerson, @Param('ref') ref: string): Promise<PublicProfile> {
    return this.profiles.view(me, decodeURIComponent(ref));
  }
}
