import type { InterviewSession, Project } from '../models/types';
import { DEMO_PROJECT, SAMPLE_INTERVIEWS, getSample } from '../data/samples';
import { sampleAudioRef } from '../services/audio/audioFiles';
import { deleteAudioFile, loadVault, wipeVault } from '../services/storage/vault';
import { newId, nowIso } from '../utils/ids';
import type { AppDispatch, RootState } from './index';
import { dataActions } from './dataSlice';
import { settingsActions, type SettingsState } from './settingsSlice';

type Thunk<R = void> = (dispatch: AppDispatch, getState: () => RootState) => R;

export const hydrateApp = (): Thunk<Promise<void>> => async (dispatch) => {
  const vault = await loadVault();
  dispatch(settingsActions.settingsHydrated(vault.settings as Partial<SettingsState> | undefined));
  dispatch(dataActions.hydrated({ projects: vault.projects, sessions: vault.sessions }));
};

export const createProject =
  (input: { name: string; researchQuestion?: string; researchContext?: string; isDemo?: boolean }): Thunk<string> =>
  (dispatch) => {
    const now = nowIso();
    const project: Project = {
      id: newId('proj'),
      name: input.name.trim() || 'Untitled project',
      researchQuestion: input.researchQuestion?.trim() ?? '',
      researchContext: input.researchContext?.trim() ?? '',
      shareContext: true,
      knownIdentifiers: [],
      isDemo: Boolean(input.isDemo),
      createdAt: now,
      updatedAt: now,
    };
    dispatch(dataActions.projectCreated(project));
    return project.id;
  };

export const createSession =
  (projectId: string, input: { title: string; participantLabel: string; isDemo?: boolean }): Thunk<string> =>
  (dispatch) => {
    const now = nowIso();
    const session: InterviewSession = {
      id: newId('sess'),
      projectId,
      title: input.title.trim() || 'Untitled interview',
      participantLabel: input.participantLabel.trim() || 'P00',
      isDemo: Boolean(input.isDemo),
      segments: [],
      researcherNotes: '',
      createdAt: now,
      updatedAt: now,
    };
    dispatch(dataActions.sessionCreated(session));
    return session.id;
  };

/** Adds a bundled synthetic interview; its transcript is a labeled sample transcript. */
export const addSampleSession =
  (projectId: string, sampleId: string): Thunk<string | null> =>
  (dispatch) => {
    const sample = getSample(sampleId);
    if (!sample) return null;
    const id = dispatch(createSession(projectId, { title: sample.title, participantLabel: sample.participantLabel, isDemo: true }));
    dispatch(dataActions.sessionAudioSet({ id, audio: sampleAudioRef(sample.id) }));
    dispatch(
      dataActions.transcriptReplaced({
        id,
        source: 'demo-sample',
        model: 'sample transcript (pre-written)',
        segments: sample.segments.map(({ startMs, endMs, text, speaker }) => ({ startMs, endMs, text, speaker })),
      }),
    );
    return id;
  };

export const createDemoProject = (): Thunk<string> => (dispatch) => {
  const projectId = dispatch(createProject({ ...DEMO_PROJECT, isDemo: true }));
  for (const sample of SAMPLE_INTERVIEWS) dispatch(addSampleSession(projectId, sample.id));
  return projectId;
};

export const deleteSession = (sessionId: string): Thunk => (dispatch, getState) => {
  const session = getState().data.sessions[sessionId];
  if (!session) return;
  deleteAudioFile(session.audio?.uri);
  dispatch(dataActions.sessionDeleted(sessionId));
};

export const deleteProject = (projectId: string): Thunk => (dispatch, getState) => {
  for (const session of Object.values(getState().data.sessions)) {
    if (session.projectId === projectId) deleteAudioFile(session.audio?.uri);
  }
  dispatch(dataActions.projectDeleted(projectId));
};

export const wipeAllData = (): Thunk => (dispatch) => {
  wipeVault();
  dispatch(dataActions.wipedAll());
};
