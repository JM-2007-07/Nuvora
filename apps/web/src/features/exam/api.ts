'use client';

import {
  type ClientExamEvent,
  EXAM_NAMESPACE,
  ExamEventResultSchema,
  ExamResultSchema,
  ExamStateSchema,
  LearnerAssessmentListSchema,
  type Locale,
  LiveExamSchema,
  SaveAnswerResultSchema,
  type TeacherExamActionRequest,
  COMMS_SOCKET_PATH,
} from '@nuvora/shared';
import { io, type Socket } from 'socket.io-client';
import { z } from 'zod';
import { clientFetch } from '@/lib/client-api';

const id = encodeURIComponent;

/** REST side of Standard Exam Mode, through the same-origin /api/v1 rewrite. */
export const examApi = {
  list: (locale: Locale) => clientFetch('/me/assessments', LearnerAssessmentListSchema, { locale }),
  start: (locale: Locale, assessmentId: string) => clientFetch(`/me/assessments/${id(assessmentId)}/attempts`, ExamStateSchema, { locale, method: 'POST' }),
  state: (locale: Locale, attemptId: string) => clientFetch(`/me/assessment-attempts/${id(attemptId)}`, ExamStateSchema, { locale }),
  saveAnswer: (locale: Locale, attemptId: string, questionId: string, optionKey: number, seq: number) =>
    clientFetch(`/me/assessment-attempts/${id(attemptId)}/answers/${id(questionId)}`, SaveAnswerResultSchema, { locale, method: 'PUT', body: { optionKey, seq } }),
  event: (locale: Locale, attemptId: string, kind: ClientExamEvent) =>
    clientFetch(`/me/assessment-attempts/${id(attemptId)}/events`, ExamEventResultSchema, { locale, method: 'POST', body: { kind, clientAt: new Date().toISOString() } }),
  submit: (locale: Locale, attemptId: string) => clientFetch(`/me/assessment-attempts/${id(attemptId)}/submit`, ExamResultSchema, { locale, method: 'POST' }),
  result: (locale: Locale, attemptId: string) => clientFetch(`/me/assessment-attempts/${id(attemptId)}/result`, ExamResultSchema, { locale }),
  live: (locale: Locale, assessmentId: string) => clientFetch(`/teach/assessments/${id(assessmentId)}/live`, LiveExamSchema, { locale }),
  act: (locale: Locale, attemptId: string, body: TeacherExamActionRequest) =>
    clientFetch(`/teach/assessment-attempts/${id(attemptId)}/actions`, z.unknown(), { locale, method: 'POST', body }),
};

/** Sockets go straight to the API origin (Next rewrites do not carry WebSocket upgrades); same as comms. */
function apiOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL;
  if (configured) return new URL(configured).origin;
  return `${window.location.protocol}//${window.location.hostname}:4000`;
}

export function connectExam(): Socket {
  return io(`${apiOrigin()}${EXAM_NAMESPACE}`, {
    path: COMMS_SOCKET_PATH,
    withCredentials: true,
    transports: ['websocket', 'polling'],
    reconnectionDelayMax: 4000,
  });
}
