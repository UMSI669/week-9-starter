import type { InterviewSession, Project, TranscriptSegment } from '../../models/types';
import samples from '../../data/sampleInterviews.json';

export function sampleSegments(id: string): TranscriptSegment[] {
  const sample = samples.interviews.find((s) => s.id === id);
  if (!sample) throw new Error(`missing sample ${id}`);
  return sample.segments.map((s) => ({ ...s, recognizedText: s.text, edited: false }));
}

export function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj_test',
    name: 'Riverside study (internal name)',
    researchQuestion: 'How do people book appointments?',
    researchContext: 'Mobile scheduling concept.',
    shareContext: true,
    knownIdentifiers: [],
    isDemo: true,
    createdAt: '2026-11-09T00:00:00.000Z',
    updatedAt: '2026-11-09T00:00:00.000Z',
    ...overrides,
  };
}

export function makeSession(segments: TranscriptSegment[], overrides: Partial<InterviewSession> = {}): InterviewSession {
  return {
    id: 'sess_test',
    projectId: 'proj_test',
    title: 'Maria Delgado interview — clinic',
    participantLabel: 'P01',
    isDemo: true,
    audio: {
      kind: 'imported',
      uri: 'file:///var/mobile/Containers/Data/vault/audio/sess_test.m4a',
      originalFilename: 'Maria_Delgado_2026-11-02.m4a',
      mimeType: 'audio/mp4',
    },
    segments,
    researcherNotes: 'Met Maria at Riverside.',
    createdAt: '2026-11-09T00:00:00.000Z',
    updatedAt: '2026-11-09T00:00:00.000Z',
    ...overrides,
  };
}
