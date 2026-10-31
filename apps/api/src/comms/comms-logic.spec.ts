import { describe, expect, it } from 'vitest';
import { CallsRegistry } from './calls-registry.js';
import { type CommsGroup, type CommsParticipant, contactsFrom, directKey, directMembers } from './directory.js';
import { allowedOrigin } from './io-adapter.js';

const teacher: CommsParticipant = { key: 'staff:dilshod-karimov', name: 'Dilshod Karimov', role: 'TEACHER' };
const amina: CommsParticipant = { key: 'user:a1', name: 'Amina', role: 'LEARNER' };
const firuz: CommsParticipant = { key: 'user:f1', name: 'Firuz', role: 'LEARNER' };
const groups: CommsGroup[] = [
  { key: 'group:demo:B-12', code: 'B-12', name: 'JS', teacher, learners: [amina, firuz] },
  { key: 'group:db:g2', code: 'B-18', name: 'JS 2', teacher, learners: [amina] },
];

describe('conversation keys', () => {
  it('direct keys are the same from both sides', () => {
    expect(directKey(amina.key, teacher.key)).toBe(directKey(teacher.key, amina.key));
    expect(directMembers(directKey(amina.key, teacher.key))).toEqual([teacher.key, amina.key].sort());
  });
  it('group keys are not direct', () => {
    expect(directMembers('group:demo:B-12')).toBeNull();
  });
});

describe('contacts', () => {
  it('a teacher reaches the learners of their groups, once each, with the shared groups', () => {
    const contacts = contactsFrom(teacher, groups);
    expect([...contacts.keys()]).toEqual([amina.key, firuz.key]);
    expect(contacts.get(amina.key)?.groups).toEqual(['B-12', 'B-18']);
  });
  it('a learner reaches their teachers only, not classmates', () => {
    expect([...contactsFrom(amina, groups).keys()]).toEqual([teacher.key]);
  });
});

describe('socket origins', () => {
  it('allows the web origin, local ports and native apps; rejects other sites', () => {
    const web = ['https://faroz-web.onrender.com'];
    expect(allowedOrigin('https://faroz-web.onrender.com', web, false)).toBe(true);
    expect(allowedOrigin('http://localhost:3001', web, true)).toBe(true);
    expect(allowedOrigin('http://localhost:3001', web, false)).toBe(false);
    expect(allowedOrigin(undefined, web, false)).toBe(true);
    expect(allowedOrigin('https://evil.example', web, true)).toBe(false);
  });
});

describe('calls registry', () => {
  const t0 = new Date('2026-10-29T10:00:00Z');
  const at = (s: number) => new Date(t0.getTime() + s * 1000);

  it('a direct call that was answered ends when either side leaves, with its duration', () => {
    const reg = new CallsRegistry();
    const call = reg.start({ conversationId: 'c1', conversationKey: 'dm:x', kind: 'DIRECT', media: 'video', by: { peerId: 's1', key: teacher.key, name: teacher.name } }, t0);
    expect(reg.join(call, { peerId: 's2', key: amina.key, name: amina.name }, at(5))).toEqual([{ peerId: 's1', key: teacher.key, name: teacher.name }]);
    const left = reg.leave(call.id, 's2', at(65));
    expect(left?.ended).toEqual({ media: 'video', event: 'ended', seconds: 60 });
    expect(reg.findIn('c1')).toBeUndefined();
  });

  it('a call nobody answered is missed; a declined one says so', () => {
    const reg = new CallsRegistry();
    const a = reg.start({ conversationId: 'c1', conversationKey: 'dm:x', kind: 'DIRECT', media: 'audio', by: { peerId: 's1', key: teacher.key, name: teacher.name } }, t0);
    expect(reg.endUnanswered(a.id, false, at(45))?.log).toEqual({ media: 'audio', event: 'missed' });
    const b = reg.start({ conversationId: 'c1', conversationKey: 'dm:x', kind: 'DIRECT', media: 'audio', by: { peerId: 's1', key: teacher.key, name: teacher.name } }, t0);
    expect(reg.endUnanswered(b.id, true, at(3))?.log).toEqual({ media: 'audio', event: 'declined' });
  });

  it('a group call stays open until the last person leaves', () => {
    const reg = new CallsRegistry();
    const call = reg.start({ conversationId: 'g', conversationKey: 'group:demo:B-12', kind: 'GROUP', media: 'video', by: { peerId: 's1', key: teacher.key, name: teacher.name } }, t0);
    reg.join(call, { peerId: 's2', key: amina.key, name: amina.name }, at(2));
    reg.join(call, { peerId: 's3', key: firuz.key, name: firuz.name }, at(3));
    expect(reg.leave(call.id, 's1', at(10))?.ended).toBeNull();
    expect(reg.activeIn('g')?.peers.map((p) => p.peerId)).toEqual(['s2', 's3']);
    expect(reg.leave(call.id, 's2', at(20))?.ended).toBeNull();
    expect(reg.leave(call.id, 's3', at(32))?.ended).toEqual({ media: 'video', event: 'ended', seconds: 30 });
  });

  it('a second device of the same person does not count as answering', () => {
    const reg = new CallsRegistry();
    const call = reg.start({ conversationId: 'c1', conversationKey: 'dm:x', kind: 'DIRECT', media: 'audio', by: { peerId: 's1', key: teacher.key, name: teacher.name } }, t0);
    reg.join(call, { peerId: 's1b', key: teacher.key, name: teacher.name }, at(1));
    expect(call.connectedAt).toBeNull();
    expect(reg.callsOfPeer('s1b')).toEqual([call.id]);
  });
});
