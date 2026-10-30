# 2026-10-29: Messages and calls inside Faroz

Status: **implemented and verified live** (two Edge windows against the real API, after the owner restarted `pnpm dev`).
Gate: G4 (Faroz)   Decision: D-24 (owner-approved in the chat, 2026-10-29)   Design: no handoff screen; built in the Faroz HUD style

## Context

The owner's idea: a teacher who cannot come to class should reach a learner, or the whole group, inside Faroz instead of switching to Zoom. The owner asked for chat, voice messages, audio and video calls and group calls, as a separate section of the dashboards, working later in a React Native app too. Everything was approved ("разрешаю всё").

## Choices

- **Chat and signalling: Socket.IO on the NestJS API.** It reconnects by itself, falls back to polling, and has an official client for React Native.
- **Calls: WebRTC in the browser, peer to peer (mesh).** No media server and no extra service. The same API exists in React Native through `react-native-webrtc`. It is good for one to one and groups of about 5–6.
- **LiveKit**, a self-hosted SFU, was the first choice for larger groups. Downloading and running its server binary was not permitted in this session; it is the upgrade path once the owner installs it (D-24).
- **NestJS socket packages pinned to 12.2.0.** The 12.3.2 versions need a newer `@nestjs/common` and failed to load (`getParamArgsMetadata`).

## Changes

**Shared:** `packages/shared/src/comms-api.ts`. Zod schemas for REST payloads, socket payloads and event names, used by both apps and the future mobile app.

**Database:** migration `20261030100000_communications` (additive): `conversations`, `messages`, `voice_clips`, `conversation_reads`.
- Applied with the owner's approval.
- SHA-256 pinned in `migrations-integrity.spec.ts`.

**API:** `apps/api/src/comms/`.
- `directory.ts`
  - Who is talking: cookie on the web, token on mobile.
  - Groups and contacts are derived from the rosters (demo groups in code and groups in the database).
  - Access checks. Centers are refused (privacy).
- `comms.service.ts` and `comms.controller.ts`
  - Overview with unread counts and active calls.
  - Direct conversations.
  - History pages, text, voice upload and playback (2 MB, 3 min), read marks.
- `comms.gateway.ts` (Socket.IO `/comms` at `/realtime`), `realtime-hub.ts`, `calls-registry.ts`
  - Presence and typing.
  - Call start, join, decline and leave, with a 45 s ring timeout.
  - SDP/ICE relay only between peers of the same call; mic/camera/screen flags.
  - A call log line in the chat when a call ends.
- `io-adapter.ts`: CORS for the web origin and local ports; native apps send no Origin.

**Web:** `apps/web/src/features/comms/`.
- `comms-provider.tsx`: one socket per workspace. It keeps the overview, unread counts, presence and typing live, and shows incoming calls and the call screen on any page.
- `call-engine.ts`
  - WebRTC mesh: whoever joins sends the offers.
  - Audio and video transceivers from the start, so the camera and screen share are a `replaceTrack`.
  - Queued ICE candidates, ICE restart on failure.
- `call-overlay.tsx`: full-screen HUD call.
  - Video tiles, or avatars when the camera is off; a mic-off badge; own preview.
  - Mute, camera, screen share, hang up.
  - Minimize to a floating pill (Escape); audio keeps playing.
- `incoming-call.tsx`: ringing card with a Web Audio ringtone; accept, accept with audio only, decline.
- `comms-view.tsx`: section "Связь" at `/app/messages` and `/teach/messages`.
  - Conversations and contacts with search.
  - Chat with day separators, grouped bubbles, voice bubbles and call log lines.
  - Typing indicator, a "join the running call" banner, a composer with voice recording and a live level meter.
  - One column on phones.
- `voice.tsx`: MediaRecorder (opus/webm, AAC/mp4 on Safari) and a player.
- Sidebar: a "Связь" item with an unread badge in the learner and teacher shells. Center staff have none.
- Messages: `Comms.*` in tg/ru/en. The ru and tg texts are AI drafts and **need review**.

**Docs:**
- D-24 in `decisions.md`.
- API contract and mobile notes in `api-conventions.md`.
- Tables in `data-model.md`.
- Socket.IO in the `AGENTS.md` toolchain.

## Verification

| Check | Result |
| --- | --- |
| api `lint`, `typecheck` | pass |
| api `test` | unit 182 (9 new: keys, contacts, origins, call registry), e2e 106 |
| New comms e2e (10 tests) | Real API on a random port, real Socket.IO clients, in-memory data. Covers 401/403, the teacher and learner directories, an outsider getting 404, live text delivery and unread/read, voice upload and playback (members only, wrong format refused), and a call that rings, joins, relays signals (and refuses foreign peers), ends and is logged. Also: decline, a group call joined while running, a socket without a session, and the mobile token. |
| web `lint`, `typecheck`, `test` (parity 3/3), `build` | pass |

**Not yet verified:**
- **The UI in a browser, and real WebRTC media between two windows.** The running dev API (`nest start --watch`, started 22:50) kept its 23:50 process and did not reload the new build, and stopping it was not permitted. Needs a restart of `pnpm dev`, then a check with two windows (teacher Dilshod and learner Amina).
- Safari/Firefox, phones, TURN across networks.

## Known limitations

- Mesh calls grow heavy beyond about 6 people (each sends video to each). Larger classes need an SFU (LiveKit).
- Across different networks (mobile data, other sites), calls need STUN/TURN (`COMMS_ICE_SERVERS`). The same machine or Wi-Fi works without.
- On one laptop, Windows may give the camera to only one browser at a time. For a two-window demo, use audio, or video plus screen sharing in the second window.
- Live calls live in API memory: restarting the API ends them.

## Follow-up the same day: live check and fixes

**Owner feedback:**
- Chat rows overflowed the list column.
- There was no way to see a group's members or to write to one of them.
- Use real icons, not emoji.

**Fixes:**
- **List rows:** a `minmax(0,1fr)` track and `min-w-0` on the list.
- **Contacts:** clicking a contact did not open the chat. The list hid direct chats without messages, so the new chat could not be selected.
- **Members:** a members panel (teacher first, online state, "Write" for people I may contact). The overview gets `members` per group.
- **Icons:** lucide icons replace the emoji in previews.
- **Recording clock:** `role="timer"`.

**Live check:** `comms-live.mjs` in the scratchpad: Edge, two contexts (Dilshod and Amina), fake camera and microphone, production web build and the real API. 28 of 29 passed:
- directory and online state; live text, typing and an unread badge;
- a voice message (8.9 kB webm, 1.9 s) that downloads for the other side;
- rows stay inside the column; a members panel listing 27 people with a working "Write";
- a video call with remote video in both directions (1280×720 frames), remote audio playing, a running timer, mute shown to the other side, minimize, end for both, and a call log line;
- a group audio call that connects and survives one person leaving;
- clean consoles.

The one miss was the script's lookup of the recording clock (the voice message itself was sent); fixed with `role="timer"`.

The check wrote a few real messages and call log lines into the demo chats between Dilshod, Amina and B-12.

## Follow-up 2026-10-30: chat management, "Chats"

**Owner request:**
- An empty chat must not appear until something is sent.
- Chats can be deleted.
- Group members can be added and removed, as in a professional messenger.
- The section is called "Chats".

**Changes:**
- **Section name:** "Chats" / «Чаты» / «Чатҳо» (nav and page title).
- **Drafts:** a direct chat opened from Contacts is listed only once it has a message or a call; until then only the open chat shows it.
- **"⋯" menu:**
  - Direct chat: delete for me, optionally "also for {name}" (erases for both).
  - Group: clear history (for me).
  - Own custom group: delete it for everyone.
  - Someone else's custom group: leave it.
  - Every action is confirmed in the existing dialog, which got a `danger` variant.
- **Members panel (teacher):**
  - "Add member" with a searchable picker of their learners.
  - Remove a learner, with confirmation. The teacher cannot be removed.
  - A removed learner loses access to that group chat but keeps their teacher as a contact.
- **New group (teacher):** a name plus learners picked from contacts. Members see it live (`conversations:changed`).
- **API:**
  - `DELETE /comms/conversations/:id`, `POST /comms/groups`, `POST|DELETE …/members`.
  - The directory now separates class rosters (contacts) from group chats (rosters plus the teacher's changes plus custom groups).
- **Migration** `20261030110000_chat_members` (additive), applied and pinned.
- **Client resync:** after a change, the client refetches the list first and the chat's history only if the chat still exists (no 404 for a chat just left or deleted).

**Verification:**
- api: `lint` and `typecheck` pass; `test` unit 184, e2e 109.
- The 3 new comms e2e tests cover: delete for me versus for everyone; members removed and added, with permissions; a custom group created, left and deleted.
- web: `lint`, `typecheck`, `test`, `build` pass.
- **Live**, `comms-manage-live.mjs`: Edge, teacher and learner, the real API. 26 of 26 passed, twice:
  - section name in ru/en/tg;
  - draft not listed; rows fit;
  - new group (2 picked) appears live for the learner;
  - add and remove members;
  - clear history only for the learner; leave group with a live update on the teacher's side;
  - delete dialog with "also for Amina" (cancelled, so the demo history stays);
  - group deleted for everyone;
  - light theme in en; clean consoles.
- The call and voice check (`comms-live.mjs`) was re-run: 29 of 29 in three of four runs. One run had a single failed check that did not reproduce; it looked like script timing.
