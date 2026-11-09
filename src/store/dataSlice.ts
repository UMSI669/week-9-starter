import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type {
  AnalysisResult,
  AudioRef,
  InterviewSession,
  KnownIdentifier,
  Project,
  RedactionState,
  ResearchCode,
  SuggestionStatus,
  Theme,
  TranscriptSegment,
  TranscriptSource,
} from '../models/types';
import { newId, nowIso, segmentId } from '../utils/ids';

export interface DataState {
  hydrated: boolean;
  projects: Record<string, Project>;
  sessions: Record<string, InterviewSession>;
}

const initialState: DataState = { hydrated: false, projects: {}, sessions: {} };

/** Any transcript change invalidates the privacy review (the cloud-bound text changed). */
function invalidateReview(session: InterviewSession) {
  if (session.redaction) {
    session.redaction.reviewedAt = null;
    session.redaction.reviewedFingerprint = null;
  }
  session.updatedAt = nowIso();
}

function touchAnalysis(session: InterviewSession) {
  if (session.analysis) session.analysis.editedByResearcher = true;
  session.updatedAt = nowIso();
}

const dataSlice = createSlice({
  name: 'data',
  initialState,
  reducers: {
    hydrated(state, action: PayloadAction<{ projects: Project[]; sessions: InterviewSession[] }>) {
      state.projects = Object.fromEntries(action.payload.projects.map((p) => [p.id, p]));
      state.sessions = Object.fromEntries(action.payload.sessions.map((s) => [s.id, s]));
      state.hydrated = true;
    },
    wipedAll(state) {
      state.projects = {};
      state.sessions = {};
    },

    projectCreated(state, action: PayloadAction<Project>) {
      state.projects[action.payload.id] = action.payload;
    },
    projectUpdated(
      state,
      action: PayloadAction<{ id: string; changes: Partial<Pick<Project, 'name' | 'researchQuestion' | 'researchContext' | 'shareContext'>> }>,
    ) {
      const project = state.projects[action.payload.id];
      if (!project) return;
      Object.assign(project, action.payload.changes, { updatedAt: nowIso() });
    },
    knownIdentifierAdded(state, action: PayloadAction<{ projectId: string; identifier: KnownIdentifier }>) {
      const project = state.projects[action.payload.projectId];
      if (!project) return;
      project.knownIdentifiers.push(action.payload.identifier);
      project.updatedAt = nowIso();
    },
    knownIdentifierRemoved(state, action: PayloadAction<{ projectId: string; id: string }>) {
      const project = state.projects[action.payload.projectId];
      if (!project) return;
      project.knownIdentifiers = project.knownIdentifiers.filter((k) => k.id !== action.payload.id);
      project.updatedAt = nowIso();
    },
    projectDeleted(state, action: PayloadAction<string>) {
      delete state.projects[action.payload];
      for (const [id, session] of Object.entries(state.sessions)) {
        if (session.projectId === action.payload) delete state.sessions[id];
      }
    },

    sessionCreated(state, action: PayloadAction<InterviewSession>) {
      state.sessions[action.payload.id] = action.payload;
    },
    sessionMetaUpdated(
      state,
      action: PayloadAction<{ id: string; changes: Partial<Pick<InterviewSession, 'title' | 'participantLabel' | 'researcherNotes'>> }>,
    ) {
      const session = state.sessions[action.payload.id];
      if (!session) return;
      Object.assign(session, action.payload.changes, { updatedAt: nowIso() });
    },
    sessionAudioSet(state, action: PayloadAction<{ id: string; audio: AudioRef | undefined }>) {
      const session = state.sessions[action.payload.id];
      if (!session) return;
      session.audio = action.payload.audio;
      session.updatedAt = nowIso();
    },
    sessionDeleted(state, action: PayloadAction<string>) {
      delete state.sessions[action.payload];
    },

    transcriptReplaced(
      state,
      action: PayloadAction<{
        id: string;
        source: TranscriptSource;
        model?: string;
        segments: { startMs: number; endMs: number; text: string; speaker?: string }[];
      }>,
    ) {
      const session = state.sessions[action.payload.id];
      if (!session) return;
      session.segments = action.payload.segments.map((s, i) => ({
        id: segmentId(i),
        startMs: s.startMs,
        endMs: s.endMs,
        speaker: s.speaker,
        text: s.text,
        recognizedText: s.text,
        edited: false,
      }));
      session.transcriptSource = action.payload.source;
      session.transcriptModel = action.payload.model;
      // A new transcript makes earlier spans and analysis meaningless.
      session.redaction = undefined;
      session.analysis = undefined;
      session.updatedAt = nowIso();
    },
    segmentEdited(
      state,
      action: PayloadAction<{ id: string; segmentId: string; changes: Partial<Pick<TranscriptSegment, 'text' | 'speaker' | 'startMs' | 'endMs'>> }>,
    ) {
      const session = state.sessions[action.payload.id];
      const segment = session?.segments.find((s) => s.id === action.payload.segmentId);
      if (!session || !segment) return;
      Object.assign(segment, action.payload.changes);
      segment.edited = segment.text !== segment.recognizedText || segment.edited;
      invalidateReview(session);
    },
    segmentAdded(state, action: PayloadAction<{ id: string; afterSegmentId?: string }>) {
      const session = state.sessions[action.payload.id];
      if (!session) return;
      const index = action.payload.afterSegmentId
        ? session.segments.findIndex((s) => s.id === action.payload.afterSegmentId)
        : session.segments.length - 1;
      const previous = session.segments[index];
      // New ids never reuse existing ones, so cloud references stay valid.
      const maxId = session.segments.reduce((m, s) => Math.max(m, Number(s.id.replace(/\D/g, '')) || 0), 0);
      const segment: TranscriptSegment = {
        id: segmentId(maxId),
        startMs: previous?.endMs ?? 0,
        endMs: previous?.endMs ?? 0,
        speaker: previous?.speaker,
        text: '',
        recognizedText: '',
        edited: true,
      };
      session.segments.splice(index + 1, 0, segment);
      if (session.transcriptSource === undefined) session.transcriptSource = 'manual';
      invalidateReview(session);
    },
    segmentDeleted(state, action: PayloadAction<{ id: string; segmentId: string }>) {
      const session = state.sessions[action.payload.id];
      if (!session) return;
      session.segments = session.segments.filter((s) => s.id !== action.payload.segmentId);
      if (session.redaction) {
        session.redaction.spans = session.redaction.spans.filter((s) => s.segmentId !== action.payload.segmentId);
      }
      invalidateReview(session);
    },

    redactionSet(state, action: PayloadAction<{ id: string; redaction: RedactionState }>) {
      const session = state.sessions[action.payload.id];
      if (!session) return;
      session.redaction = action.payload.redaction;
      session.updatedAt = nowIso();
    },
    redactionReviewed(state, action: PayloadAction<{ id: string; fingerprint: string }>) {
      const session = state.sessions[action.payload.id];
      if (!session?.redaction) return;
      session.redaction.reviewedAt = nowIso();
      session.redaction.reviewedFingerprint = action.payload.fingerprint;
    },

    analysisSet(state, action: PayloadAction<{ id: string; analysis: AnalysisResult | undefined }>) {
      const session = state.sessions[action.payload.id];
      if (!session) return;
      session.analysis = action.payload.analysis;
      session.updatedAt = nowIso();
    },
    summaryEdited(state, action: PayloadAction<{ id: string; summary: string }>) {
      const session = state.sessions[action.payload.id];
      if (!session?.analysis) return;
      session.analysis.summary = action.payload.summary;
      touchAnalysis(session);
    },
    codeUpserted(state, action: PayloadAction<{ id: string; code: Partial<ResearchCode> & { id?: string } }>) {
      const session = state.sessions[action.payload.id];
      if (!session?.analysis) return;
      const { code } = action.payload;
      const existing = code.id ? session.analysis.codes.find((c) => c.id === code.id) : undefined;
      if (existing) {
        Object.assign(existing, code);
      } else {
        session.analysis.codes.push({
          id: newId('code'),
          label: code.label ?? 'New code',
          description: code.description ?? '',
          segmentIds: code.segmentIds ?? [],
          origin: 'researcher',
          status: 'accepted',
        });
      }
      touchAnalysis(session);
    },
    codeStatusSet(state, action: PayloadAction<{ id: string; codeId: string; status: SuggestionStatus }>) {
      const code = state.sessions[action.payload.id]?.analysis?.codes.find((c) => c.id === action.payload.codeId);
      if (!code) return;
      code.status = action.payload.status;
      touchAnalysis(state.sessions[action.payload.id]);
    },
    codeDeleted(state, action: PayloadAction<{ id: string; codeId: string }>) {
      const analysis = state.sessions[action.payload.id]?.analysis;
      if (!analysis) return;
      analysis.codes = analysis.codes.filter((c) => c.id !== action.payload.codeId);
      analysis.themes.forEach((t) => (t.codeIds = t.codeIds.filter((id) => id !== action.payload.codeId)));
      analysis.quotes.forEach((q) => (q.codeIds = q.codeIds.filter((id) => id !== action.payload.codeId)));
      touchAnalysis(state.sessions[action.payload.id]);
    },
    themeUpserted(state, action: PayloadAction<{ id: string; theme: Partial<Theme> & { id?: string } }>) {
      const session = state.sessions[action.payload.id];
      if (!session?.analysis) return;
      const { theme } = action.payload;
      const existing = theme.id ? session.analysis.themes.find((t) => t.id === theme.id) : undefined;
      if (existing) {
        Object.assign(existing, theme);
      } else {
        session.analysis.themes.push({
          id: newId('theme'),
          title: theme.title ?? 'New theme',
          description: theme.description ?? '',
          codeIds: theme.codeIds ?? [],
          origin: 'researcher',
          status: 'accepted',
        });
      }
      touchAnalysis(session);
    },
    themeStatusSet(state, action: PayloadAction<{ id: string; themeId: string; status: SuggestionStatus }>) {
      const theme = state.sessions[action.payload.id]?.analysis?.themes.find((t) => t.id === action.payload.themeId);
      if (!theme) return;
      theme.status = action.payload.status;
      touchAnalysis(state.sessions[action.payload.id]);
    },
    themeDeleted(state, action: PayloadAction<{ id: string; themeId: string }>) {
      const analysis = state.sessions[action.payload.id]?.analysis;
      if (!analysis) return;
      analysis.themes = analysis.themes.filter((t) => t.id !== action.payload.themeId);
      touchAnalysis(state.sessions[action.payload.id]);
    },
    quoteDeleted(state, action: PayloadAction<{ id: string; quoteId: string }>) {
      const analysis = state.sessions[action.payload.id]?.analysis;
      if (!analysis) return;
      analysis.quotes = analysis.quotes.filter((q) => q.id !== action.payload.quoteId);
      touchAnalysis(state.sessions[action.payload.id]);
    },
  },
});

export const dataActions = dataSlice.actions;
export default dataSlice.reducer;
