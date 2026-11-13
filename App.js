import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  createQuestion,
  DIFFICULTY_TIME_SECONDS,
  formatTime,
  validateTypedAnswer,
} from './src/quiz';
import { loadSessions, saveSession } from './src/sessionStorage';
import { useVoiceAnswer } from './src/hooks/useVoiceAnswer';
import { isOpenRouterConfigured } from './src/services/stt/openRouterConfig';
import { parseSpokenAnswer } from './src/spokenNumber';

const VOICE_CONFIGURED = isOpenRouterConfigured();

const COLORS = {
  ink: '#30234F',
  muted: '#7D748E',
  purple: '#7450D5',
  palePurple: '#EEE7FB',
  paper: '#F8F5EF',
  white: '#FFFFFF',
  green: '#206A50',
  paleGreen: '#E0F1E5',
  red: '#AE3B4A',
  paleRed: '#F9E3E1',
  yellow: '#FFF0B8',
};

export default function App() {
  return (
    <SafeAreaProvider>
      <KidsTimesTables />
    </SafeAreaProvider>
  );
}

function KidsTimesTables() {
  const [screen, setScreen] = useState('home');
  const [difficultyDialogOpen, setDifficultyDialogOpen] = useState(false);
  const [difficulty, setDifficulty] = useState('Medium');
  const [question, setQuestion] = useState(() => createQuestion());
  const [correct, setCorrect] = useState(0);
  const [incorrect, setIncorrect] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(DIFFICULTY_TIME_SECONDS.Medium);
  const [phase, setPhase] = useState('idle');
  const [feedbackSecondsLeft, setFeedbackSecondsLeft] = useState(3);
  const [feedbackProgress, setFeedbackProgress] = useState(0);
  const [typedDialogOpen, setTypedDialogOpen] = useState(false);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [validationMessage, setValidationMessage] = useState('');
  const [answerFeedback, setAnswerFeedback] = useState(null);
  const [exitDialogOpen, setExitDialogOpen] = useState(false);
  const [celebrationOpen, setCelebrationOpen] = useState(false);
  const [completedSession, setCompletedSession] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [saveFailed, setSaveFailed] = useState(false);
  const [storageLoading, setStorageLoading] = useState(true);
  const [voiceMessage, setVoiceMessage] = useState('');

  const answerInputRef = useRef(null);
  const deadlineRef = useRef(null);
  const feedbackDeadlineRef = useRef(null);
  const phaseRef = useRef('idle');
  const screenRef = useRef('home');
  const endedRef = useRef(true);
  const savedRef = useRef(false);
  const generationRef = useRef(0);
  const correctRef = useRef(0);
  const incorrectRef = useRef(0);
  const difficultyRef = useRef('Medium');
  const questionRef = useRef(question);
  const finishSessionRef = useRef(() => {});
  const feedbackIntervalRef = useRef(null);
  const feedbackMessageIdRef = useRef(0);
  const submissionLockRef = useRef(false);
  const submissionUnlockTimeoutRef = useRef(null);
  const handleTranscriptRef = useRef(() => {});

  // Voice is the default way to answer. Results arrive through these callbacks,
  // including when the 10-second recording limit stops the microphone.
  const voice = useVoiceAnswer({
    onTranscript: (transcript) => handleTranscriptRef.current(transcript),
    onError: (message) => setVoiceMessage(message),
  });
  const cancelVoice = voice.cancel;

  screenRef.current = screen;
  questionRef.current = question;
  correctRef.current = correct;
  incorrectRef.current = incorrect;
  difficultyRef.current = difficulty;

  useEffect(() => {
    let active = true;
    loadSessions().then((savedSessions) => {
      if (!active) return;
      setSessions(savedSessions);
      setStorageLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const clearFeedbackTimer = useCallback(() => {
    if (feedbackIntervalRef.current) {
      clearInterval(feedbackIntervalRef.current);
      feedbackIntervalRef.current = null;
    }
    feedbackDeadlineRef.current = null;
  }, []);

  const finishSession = useCallback(async () => {
    if (endedRef.current || screenRef.current !== 'quiz') return;

    endedRef.current = true;
    phaseRef.current = 'finished';
    setPhase('finished');
    clearFeedbackTimer();
    if (submissionUnlockTimeoutRef.current) clearTimeout(submissionUnlockTimeoutRef.current);
    submissionUnlockTimeoutRef.current = null;
    submissionLockRef.current = false;
    cancelVoice();
    setVoiceMessage('');
    setTypedDialogOpen(false);
    setExitDialogOpen(false);
    setAnswerFeedback(null);
    setFeedbackSecondsLeft(3);
    setFeedbackProgress(0);

    const session = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
      completedAt: new Date().toISOString(),
      difficulty: difficultyRef.current,
      correct: correctRef.current,
      incorrect: incorrectRef.current,
    };
    setCompletedSession(session);
    setSaveFailed(false);
    setScreen('results');
    setCelebrationOpen(true);

    if (!savedRef.current) {
      savedRef.current = true;
      try {
        await saveSession(session);
        setSessions(await loadSessions());
      } catch {
        setSaveFailed(true);
      }
    }
  }, [cancelVoice, clearFeedbackTimer]);

  finishSessionRef.current = finishSession;

  useEffect(() => {
    if (screen !== 'quiz') return undefined;

    const updateFromDeadline = () => {
      if (endedRef.current || !deadlineRef.current) return;
      const millisecondsLeft = deadlineRef.current - Date.now();
      if (millisecondsLeft <= 0) {
        setRemainingSeconds(0);
        finishSessionRef.current();
        return;
      }
      const secondsLeft = Math.max(0, Math.ceil(millisecondsLeft / 1000));
      setRemainingSeconds((current) => (current === secondsLeft ? current : secondsLeft));
    };

    const interval = setInterval(updateFromDeadline, 150);
    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') updateFromDeadline();
      // Recording does not continue in the background; drop the attempt.
      if (nextState === 'background') cancelVoice();
    });
    updateFromDeadline();

    return () => {
      clearInterval(interval);
      appStateSubscription.remove();
    };
  }, [cancelVoice, screen]);

  useEffect(() => {
    if (!typedDialogOpen) return undefined;
    const focusTimeout = setTimeout(() => answerInputRef.current?.focus(), 180);
    return () => clearTimeout(focusTimeout);
  }, [typedDialogOpen]);

  useEffect(() => () => {
    clearFeedbackTimer();
    if (submissionUnlockTimeoutRef.current) clearTimeout(submissionUnlockTimeoutRef.current);
  }, [clearFeedbackTimer]);

  const beginQuiz = useCallback((nextDifficulty) => {
    cancelVoice();
    setVoiceMessage('');
    clearFeedbackTimer();
    if (submissionUnlockTimeoutRef.current) clearTimeout(submissionUnlockTimeoutRef.current);
    submissionLockRef.current = false;
    generationRef.current += 1;
    feedbackMessageIdRef.current += 1;
    const firstQuestion = createQuestion();
    endedRef.current = false;
    savedRef.current = false;
    phaseRef.current = 'answering';
    difficultyRef.current = nextDifficulty;
    correctRef.current = 0;
    incorrectRef.current = 0;
    questionRef.current = firstQuestion;
    deadlineRef.current = Date.now() + DIFFICULTY_TIME_SECONDS[nextDifficulty] * 1000;

    setDifficulty(nextDifficulty);
    setQuestion(firstQuestion);
    setCorrect(0);
    setIncorrect(0);
    setRemainingSeconds(DIFFICULTY_TIME_SECONDS[nextDifficulty]);
    setPhase('answering');
    setAnswerFeedback(null);
    setFeedbackSecondsLeft(3);
    setFeedbackProgress(0);
    setTypedAnswer('');
    setValidationMessage('');
    setCompletedSession(null);
    setSaveFailed(false);
    setCelebrationOpen(false);
    setDifficultyDialogOpen(false);
    setExitDialogOpen(false);
    setTypedDialogOpen(false);
    setScreen('quiz');
  }, [cancelVoice, clearFeedbackTimer]);

  const leaveQuiz = useCallback(() => {
    cancelVoice();
    setVoiceMessage('');
    generationRef.current += 1;
    feedbackMessageIdRef.current += 1;
    if (submissionUnlockTimeoutRef.current) clearTimeout(submissionUnlockTimeoutRef.current);
    submissionLockRef.current = false;
    endedRef.current = true;
    phaseRef.current = 'idle';
    deadlineRef.current = null;
    clearFeedbackTimer();
    setTypedDialogOpen(false);
    setExitDialogOpen(false);
    setAnswerFeedback(null);
    setPhase('idle');
    setScreen('home');
  }, [cancelVoice, clearFeedbackTimer]);

  // Voice integration boundary: typed answers and voice transcripts both call this same function.
  const submitAnswer = useCallback((answer) => {
    if (
      endedRef.current ||
      screenRef.current !== 'quiz' ||
      phaseRef.current !== 'answering' ||
      submissionLockRef.current
    ) return false;

    if (!Number.isSafeInteger(answer) || answer < 0) return false;

    if (Date.now() >= deadlineRef.current) {
      finishSessionRef.current();
      return false;
    }

    submissionLockRef.current = true;
    submissionUnlockTimeoutRef.current = setTimeout(() => {
      submissionLockRef.current = false;
      submissionUnlockTimeoutRef.current = null;
    }, 300);

    const currentQuestion = questionRef.current;
    const isCorrect = answer === currentQuestion.left * currentQuestion.right;
    setTypedDialogOpen(false);
    setValidationMessage('');
    setVoiceMessage('');
    Keyboard.dismiss();

    if (isCorrect) {
      const nextCorrect = correctRef.current + 1;
      correctRef.current = nextCorrect;
      setCorrect(nextCorrect);
      setAnswerFeedback({ tone: 'correct', message: 'Correct!' });
      const feedbackId = feedbackMessageIdRef.current + 1;
      feedbackMessageIdRef.current = feedbackId;
      setTimeout(() => {
        if (feedbackMessageIdRef.current === feedbackId && !endedRef.current) {
          setAnswerFeedback(null);
        }
      }, 900);
      const nextQuestion = createQuestion();
      questionRef.current = nextQuestion;
      setQuestion(nextQuestion);
      setFeedbackSecondsLeft(3);
      setFeedbackProgress(0);
      return true;
    }

    const nextIncorrect = incorrectRef.current + 1;
    incorrectRef.current = nextIncorrect;
    setIncorrect(nextIncorrect);
    phaseRef.current = 'incorrect-feedback';
    setPhase('incorrect-feedback');
    setAnswerFeedback({
      tone: 'incorrect',
      message: `Incorrect. ${currentQuestion.left} × ${currentQuestion.right} = ${currentQuestion.left * currentQuestion.right}.`,
    });
    setFeedbackSecondsLeft(3);
    setFeedbackProgress(0);

    const generation = generationRef.current;
    clearFeedbackTimer();
    feedbackDeadlineRef.current = Date.now() + 3000;
    const updateFeedbackCountdown = () => {
      if (generation !== generationRef.current || endedRef.current || screenRef.current !== 'quiz') {
        clearFeedbackTimer();
        return;
      }

      const millisecondsLeft = Math.max(0, feedbackDeadlineRef.current - Date.now());
      const secondsLeft = Math.ceil(millisecondsLeft / 1000);
      const elapsedMilliseconds = 3000 - millisecondsLeft;
      setFeedbackSecondsLeft(secondsLeft);
      // Fill the bar over the first two seconds, then hold it full while the 1-second label remains.
      setFeedbackProgress(Math.min(1, elapsedMilliseconds / 2000));
      if (millisecondsLeft > 0) return;

      clearFeedbackTimer();
      if (Date.now() >= deadlineRef.current) {
        finishSessionRef.current();
        return;
      }

      const nextQuestion = createQuestion();
      questionRef.current = nextQuestion;
      setQuestion(nextQuestion);
      setAnswerFeedback(null);
      setFeedbackSecondsLeft(3);
      setFeedbackProgress(0);
      phaseRef.current = 'answering';
      setPhase('answering');
    };
    feedbackIntervalRef.current = setInterval(updateFeedbackCountdown, 50);
    return true;
  }, [clearFeedbackTimer]);

  const handleTypedSubmit = useCallback(() => {
    const parsed = validateTypedAnswer(typedAnswer);
    if (!parsed.valid) {
      setValidationMessage(parsed.message);
      return;
    }
    setTypedAnswer('');
    setValidationMessage('');
    submitAnswer(parsed.answer);
  }, [submitAnswer, typedAnswer]);

  // Final transcript -> validated integer -> submitAnswer. Unclear speech asks
  // the player to try again and never counts as a wrong answer.
  handleTranscriptRef.current = (transcript) => {
    if (endedRef.current || screenRef.current !== 'quiz' || phaseRef.current !== 'answering') return;
    const parsed = parseSpokenAnswer(transcript);
    if (!parsed.valid) {
      setVoiceMessage(parsed.message);
      return;
    }
    setVoiceMessage('');
    submitAnswer(parsed.answer);
  };

  const startVoiceAnswer = async () => {
    if (phaseRef.current !== 'answering' || endedRef.current) return;
    if (!VOICE_CONFIGURED) {
      openTypedDialog();
      return;
    }
    setVoiceMessage('');
    try {
      await voice.start();
    } catch (error) {
      setVoiceMessage(`${error.message} You can type your answer instead.`);
    }
  };

  const openRecords = useCallback(async () => {
    setStorageLoading(true);
    setSessions(await loadSessions());
    setStorageLoading(false);
    setScreen('records');
  }, []);

  const playAgain = useCallback(() => {
    setCelebrationOpen(false);
    beginQuiz(completedSession?.difficulty || 'Medium');
  }, [beginQuiz, completedSession]);

  const openTypedDialog = () => {
    if (phaseRef.current !== 'answering' || endedRef.current) return;
    cancelVoice();
    setVoiceMessage('');
    setTypedAnswer('');
    setValidationMessage('');
    setTypedDialogOpen(true);
  };

  const closeTypedDialog = () => {
    setTypedDialogOpen(false);
    setTypedAnswer('');
    setValidationMessage('');
    Keyboard.dismiss();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <View style={styles.appFrame}>
        {screen === 'home' && (
          <HomeScreen
            onStart={() => setDifficultyDialogOpen(true)}
            onRecords={openRecords}
          />
        )}
        {screen === 'quiz' && (
          <QuizScreen
            difficulty={difficulty}
            question={question}
            correct={correct}
            incorrect={incorrect}
            remainingSeconds={remainingSeconds}
            phase={phase}
            feedback={answerFeedback}
            feedbackSecondsLeft={feedbackSecondsLeft}
            feedbackProgress={feedbackProgress}
            voiceStatus={voice.status}
            voiceMessage={voiceMessage}
            onRecordAnswer={startVoiceAnswer}
            onStopRecording={voice.stopAndTranscribe}
            onTypeAnswer={openTypedDialog}
            onBack={() => {
              cancelVoice();
              setExitDialogOpen(true);
            }}
          />
        )}
        {screen === 'results' && (
          <ResultsScreen
            session={completedSession}
            recentSessions={sessions.slice(0, 3)}
            saveFailed={saveFailed}
            onPlayAgain={playAgain}
            onRecords={openRecords}
            onHome={() => setScreen('home')}
          />
        )}
        {screen === 'records' && (
          <RecordsScreen
            sessions={sessions.slice(0, 10)}
            loading={storageLoading}
            onBack={() => setScreen('home')}
          />
        )}
      </View>

      <Modal
        visible={difficultyDialogOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDifficultyDialogOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard} accessibilityViewIsModal>
            <Text accessibilityRole="header" style={styles.modalTitle}>Choose your level</Text>
            <Text style={styles.modalDescription}>
              Every level uses the same times tables. Pick how long you’d like to practice.
            </Text>
            <View style={styles.levelChoices}>
              {Object.entries(DIFFICULTY_TIME_SECONDS).map(([level, seconds]) => (
                <Pressable
                  key={level}
                  accessibilityRole="button"
                  accessibilityLabel={`${level}, ${seconds / 60} ${seconds === 60 ? 'minute' : 'minutes'}`}
                  onPress={() => beginQuiz(level)}
                  style={({ pressed }) => [styles.levelChoice, pressed && styles.buttonPressed]}
                >
                  <Text style={styles.levelChoiceName}>{level}</Text>
                  <Text style={styles.levelChoiceTime}>
                    {seconds / 60} {seconds === 60 ? 'minute' : 'minutes'}
                  </Text>
                </Pressable>
              ))}
            </View>
            <AppButton
              title="Cancel"
              variant="secondary"
              onPress={() => setDifficultyDialogOpen(false)}
              style={styles.levelCancelButton}
            />
          </View>
        </View>
      </Modal>

      <Modal
        visible={typedDialogOpen}
        transparent
        animationType="fade"
        onRequestClose={closeTypedDialog}
      >
        <KeyboardAvoidingView
          style={styles.typedModalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard} accessibilityViewIsModal>
            <Text accessibilityRole="header" style={styles.modalTitle}>Type your answer</Text>
            <Text style={styles.modalDescription}>
              {VOICE_CONFIGURED
                ? 'Type your answer here.'
                : 'Type your answer here. Voice answers need an OpenRouter API key in .env.'}
            </Text>
            <TextInput
              ref={answerInputRef}
              value={typedAnswer}
              onChangeText={(value) => {
                setTypedAnswer(value);
                setValidationMessage('');
              }}
              onSubmitEditing={handleTypedSubmit}
              accessibilityLabel="Multiplication answer"
              accessibilityHint="Enter a whole number, then submit your answer"
              keyboardType="number-pad"
              inputMode="numeric"
              autoCorrect={false}
              style={styles.answerInput}
              placeholder="Your answer"
              placeholderTextColor="#9A91A7"
            />
            {validationMessage ? (
              <Text accessibilityRole="alert" style={styles.validationText}>
                {validationMessage}
              </Text>
            ) : null}
            <View style={styles.modalButtonRow}>
              <AppButton title="Cancel" variant="secondary" onPress={closeTypedDialog} />
              <AppButton title="Submit" onPress={handleTypedSubmit} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={exitDialogOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setExitDialogOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard} accessibilityViewIsModal>
            <Text accessibilityRole="header" style={styles.modalTitle}>Leave this quiz?</Text>
            <Text style={styles.modalDescription}>
              This unfinished round will not be saved.
            </Text>
            <View style={styles.modalButtonRow}>
              <AppButton title="Keep playing" variant="secondary" onPress={() => setExitDialogOpen(false)} />
              <AppButton title="Leave quiz" onPress={leaveQuiz} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={celebrationOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCelebrationOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard} accessibilityViewIsModal>
            <Text style={styles.trophy} accessibilityLabel="Trophy">🏆</Text>
            <Text accessibilityRole="header" style={styles.modalTitle}>Great practice!</Text>
            <Text style={styles.modalDescription}>
              You got {completedSession?.correct || 0} right and {completedSession?.incorrect || 0} wrong!
            </Text>
            <AppButton title="See your results" onPress={() => setCelebrationOpen(false)} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function HomeScreen({ onStart, onRecords }) {
  return (
    <ScrollView
      contentContainerStyle={styles.homeContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.homeHeading}>
        <Text accessibilityRole="header" style={styles.brandTitle}>Little practice.</Text>
        <Text style={styles.brandTitle}>Learn calculate.</Text>
      </View>

      <View style={styles.homeIllustrationWrap}>
        <View style={styles.accentShape} />
        <View style={styles.accentShapeWarm} />
        <View style={styles.challengeCard}>
          <Text style={styles.eyebrow}>A LITTLE CHALLENGE</Text>
          <Text style={styles.challengeEquation}>9 × 8 = ?</Text>
        </View>
        <Text style={styles.sparkleLeft} accessibilityLabel="Sparkle">✧</Text>
        <Text style={styles.sparkleRight} accessibilityLabel="Sparkle">✧</Text>
      </View>

      <AppButton title="▶   Start quiz" onPress={onStart} style={styles.startButton} />
      <Text style={styles.durationText}>Choose a level · 1 to 5 minutes</Text>
      <AppButton title="◴   My records" variant="white" onPress={onRecords} style={styles.recordsHomeButton} />
    </ScrollView>
  );
}

function QuizScreen({
  difficulty,
  question,
  correct,
  incorrect,
  remainingSeconds,
  phase,
  feedback,
  feedbackSecondsLeft,
  feedbackProgress,
  voiceStatus,
  voiceMessage,
  onRecordAnswer,
  onStopRecording,
  onTypeAnswer,
  onBack,
}) {
  const showingWrongAnswer = phase === 'incorrect-feedback';
  const recordingPreview = voiceStatus !== 'idle';
  const processing = voiceStatus === 'processing';
  const listeningText = voiceStatus === 'starting'
    ? 'Getting the microphone ready…'
    : processing
      ? 'Checking your answer…'
      : 'Say your answer, then tap stop.';
  return (
    <ScrollView contentContainerStyle={styles.quizContent} showsVerticalScrollIndicator={false}>
      <View style={styles.quizTopRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Leave quiz"
          onPress={onBack}
          style={styles.backButton}
          hitSlop={8}
        >
          <Text style={styles.backArrow}>‹</Text>
        </Pressable>
        <View style={styles.timerPill} accessibilityLabel={`${formatTime(remainingSeconds)} remaining`}>
          <Text style={styles.timerIcon}>◷</Text>
          <Text style={styles.timerText}>{formatTime(remainingSeconds)}</Text>
        </View>
        <View style={styles.backButtonSpacer} />
      </View>

      <View style={styles.quizMetaRow}>
        {recordingPreview ? (
          <Text style={styles.quizMeta}>
            QUESTION {String(correct + incorrect + 1).padStart(2, '0')}
          </Text>
        ) : (
          <>
            <Text style={styles.quizMeta}>
              {DIFFICULTY_TIME_SECONDS[difficulty] / 60} {DIFFICULTY_TIME_SECONDS[difficulty] === 60 ? 'MINUTE' : 'MINUTES'}
            </Text>
            <Text style={styles.quizMeta}>{difficulty.toUpperCase()}</Text>
          </>
        )}
      </View>
      {!recordingPreview && (
        <View style={styles.scoreRow}>
          <Text style={styles.scoreText}>✓ {correct} right</Text>
          <Text style={styles.scoreSeparator}>·</Text>
          <Text style={styles.scoreText}>× {incorrect} wrong</Text>
        </View>
      )}

      {recordingPreview ? (
        <Text accessibilityLiveRegion="polite" style={styles.listeningHeading}>
          {processing ? 'Thinking…' : 'Listening…'}
        </Text>
      ) : feedback?.tone === 'correct' ? (
        <Text accessibilityLiveRegion="polite" style={styles.quickCorrect}>✓ Correct!</Text>
      ) : showingWrongAnswer ? (
        <Text accessibilityRole="alert" style={styles.encouragement}>Keep growing!</Text>
      ) : <View style={styles.headingPlaceholder} />}

      <View style={[
        styles.questionCard,
        showingWrongAnswer && styles.questionCardWrong,
      ]}>
        <Text style={styles.eyebrow}>{showingWrongAnswer ? 'THE ANSWER IS' : 'HOW MUCH IS…'}</Text>
        <Text style={[
          styles.questionEquation,
          showingWrongAnswer && styles.questionEquationWrong,
        ]}>
          {question.left} × {question.right} = {showingWrongAnswer ? question.left * question.right : ' ?'}
        </Text>
        {showingWrongAnswer ? (
          <View style={styles.answerFeedbackWrong}>
            <Text style={styles.answerFeedbackIcon}>×</Text>
            <Text accessibilityLiveRegion="assertive" style={styles.answerFeedbackTextWrong}>
              {feedback?.message}
            </Text>
          </View>
        ) : (
          <Text style={styles.questionHint}>?</Text>
        )}
      </View>

      {recordingPreview ? (
        <View style={styles.recordingActionBlock}>
          <Waveform />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Stop recording"
            accessibilityHint="Stops listening and checks your answer"
            accessibilityState={{ disabled: voiceStatus !== 'recording' }}
            disabled={voiceStatus !== 'recording'}
            onPress={onStopRecording}
            style={({ pressed }) => [
              styles.stopRecordingButton,
              pressed && styles.buttonPressed,
              voiceStatus !== 'recording' && styles.buttonDisabled,
            ]}
          >
            <Text style={styles.stopRecordingButtonText}>
              {processing ? 'Checking…' : '■   Stop recording'}
            </Text>
          </Pressable>
          <Text accessibilityLiveRegion="polite" style={styles.listeningHint}>{listeningText}</Text>
        </View>
      ) : showingWrongAnswer ? (
        <View style={styles.waitingBlock}>
          <Text style={styles.waitingText}>
            Next card in {feedbackSecondsLeft} {feedbackSecondsLeft === 1 ? 'second' : 'seconds'}
          </Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${feedbackProgress * 100}%` }]} />
          </View>
        </View>
      ) : (
        <View style={styles.answerActionBlock}>
          {voiceMessage ? (
            <Text accessibilityRole="alert" style={styles.voiceMessage}>{voiceMessage}</Text>
          ) : null}
          <AppButton
            title={voiceMessage ? '🎤   Try again' : '🎤   Record answer'}
            onPress={onRecordAnswer}
            style={styles.recordButton}
            accessibilityHint="Starts listening for your spoken answer"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityHint="Opens a box to type your answer"
            onPress={onTypeAnswer}
            hitSlop={10}
          >
            <Text style={styles.typedHint}>Or type your answer</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

function Waveform() {
  const barHeights = [9, 17, 27, 15, 22, 12, 20];
  return (
    <View
      style={styles.waveform}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {barHeights.map((height, index) => (
        <View key={index} style={[styles.waveformBar, { height }]} />
      ))}
    </View>
  );
}

function ResultsScreen({ session, recentSessions, saveFailed, onPlayAgain, onRecords, onHome }) {
  return (
    <ScrollView contentContainerStyle={styles.resultsContent} showsVerticalScrollIndicator={false}>
      <ScreenHeader title="Quiz complete" onBack={onHome} />
      <View style={styles.resultHero}>
        <View style={styles.trophyBadge}><Text style={styles.trophy}>🏆</Text></View>
        <Text accessibilityRole="header" style={styles.resultHeadline}>
          {(session?.incorrect || 0) === 0 ? 'Success!' : 'Great practice!'}
        </Text>
        <Text style={styles.resultDifficulty}>{session?.difficulty} level</Text>
        <View style={styles.resultScoreRow}>
          <View style={styles.resultScoreCorrect}>
            <Text style={styles.resultScoreText}>
              <Text style={styles.resultScoreNumber}>{session?.correct || 0}</Text> correct
            </Text>
          </View>
          <View style={styles.resultScoreWrong}>
            <Text style={styles.resultScoreWrongText}>
              <Text style={styles.resultScoreWrongNumber}>{session?.incorrect || 0}</Text> wrong
            </Text>
          </View>
        </View>
        {saveFailed ? (
          <Text accessibilityRole="alert" style={styles.saveWarning}>
            Your results are here, but this score could not be saved.
          </Text>
        ) : null}
        <AppButton title="Play again   →" onPress={onPlayAgain} style={styles.playAgainButton} />
      </View>

      <View style={styles.sectionHeadingRow}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>Recent records</Text>
        <Pressable accessibilityRole="button" onPress={onRecords} hitSlop={8}>
          <Text style={styles.viewAll}>View all →</Text>
        </Pressable>
      </View>
      <View style={styles.compactListHeader}>
        <Text style={styles.listHeaderDate}>DATE &amp; TIME</Text>
        <Text style={styles.listHeaderCount}>RIGHT / WRONG</Text>
      </View>
      {recentSessions.length > 0 ? recentSessions.map((item) => (
        <SessionRow key={item.id} session={item} compact />
      )) : (
        <Text style={styles.emptySessions}>Your first quiz score will show up here.</Text>
      )}
    </ScrollView>
  );
}

function RecordsScreen({ sessions, loading, onBack }) {
  const latest = sessions[0];
  return (
    <ScrollView contentContainerStyle={styles.recordsContent} showsVerticalScrollIndicator={false}>
      <ScreenHeader title="My records" onBack={onBack} />
      <Text accessibilityRole="header" style={styles.recordsHeadline}>Look how far{ '\n' }you’ve come.</Text>
      <Text style={styles.recordsSubhead}>Your latest 10 quizzes, newest first.</Text>

      {latest ? (
        <View style={styles.latestCard}>
          <View style={styles.latestIcon}><Text style={styles.latestCheck}>✓</Text></View>
          <View style={styles.latestTextGroup}>
            <Text style={styles.latestLabel}>LATEST QUIZ · {latest.difficulty.toUpperCase()}</Text>
            <Text style={styles.latestScore}>{latest.correct} correct {latest.correct === 1 ? 'answer' : 'answers'}</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.listHeader}>
        <Text style={styles.listHeaderDate}>DATE &amp; TIME</Text>
        <Text style={styles.listHeaderCount}>CORRECT</Text>
      </View>
      {loading ? (
        <Text style={styles.emptySessions}>Loading your scores…</Text>
      ) : sessions.length ? sessions.map((session) => (
        <SessionRow key={session.id} session={session} />
      )) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No scores yet</Text>
          <Text style={styles.emptySessions}>Start your first quiz and your score will appear here.</Text>
        </View>
      )}

      <AppButton title="Back to home   →" onPress={onBack} style={styles.recordsBackButton} />
    </ScrollView>
  );
}

function ScreenHeader({ title, onBack }) {
  return (
    <View style={styles.screenHeader}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={onBack}
        style={styles.backButton}
        hitSlop={8}
      >
        <Text style={styles.backArrow}>‹</Text>
      </Pressable>
      <Text accessibilityRole="header" style={styles.screenHeaderTitle}>{title}</Text>
      <View style={styles.backButtonSpacer} />
    </View>
  );
}

function SessionRow({ session, compact = false }) {
  const date = new Date(session.completedAt);
  const readableDate = date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  return (
    <View style={[styles.sessionRow, compact && styles.sessionRowCompact]}>
      <View style={styles.sessionMain}>
        <Text style={styles.sessionDate}>{readableDate}</Text>
        <Text style={styles.sessionDifficulty}>{session.difficulty} · {session.incorrect} wrong</Text>
      </View>
      {compact ? (
        <Text style={styles.compactSessionScore}>
          <Text style={styles.compactSessionCorrect}>{session.correct}</Text>
          <Text style={styles.compactSessionSeparator}> / </Text>
          <Text style={styles.compactSessionWrong}>{session.incorrect}</Text>
        </Text>
      ) : (
        <Text style={styles.sessionCorrect}>{session.correct}</Text>
      )}
    </View>
  );
}

function AppButton({ title, onPress, variant = 'primary', style, accessibilityHint, disabled = false }) {
  const variantStyle = variant === 'secondary'
    ? styles.buttonSecondary
    : variant === 'white'
      ? styles.buttonWhite
      : styles.buttonPrimary;
  const textStyle = variant === 'secondary'
    ? styles.buttonSecondaryText
    : variant === 'white'
      ? styles.buttonWhiteText
      : styles.buttonPrimaryText;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variantStyle,
        style,
        pressed && !disabled && styles.buttonPressed,
        disabled && styles.buttonDisabled,
      ]}
    >
      <Text style={[styles.buttonText, textStyle]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.paper },
  appFrame: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center' },
  homeContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 50,
    paddingBottom: 22,
    alignItems: 'stretch',
  },
  homeHeading: { alignItems: 'center', marginTop: 10 },
  brandTitle: {
    color: COLORS.ink,
    fontSize: 34,
    lineHeight: 43,
    fontWeight: '900',
    letterSpacing: 0.2,
    textAlign: 'center',
    fontFamily: Platform.select({ ios: 'Avenir Next', android: 'sans-serif-rounded', default: undefined }),
  },
  homeIllustrationWrap: { height: 195, marginTop: 92, justifyContent: 'center', alignItems: 'center' },
  accentShape: {
    position: 'absolute',
    width: '84%',
    height: 150,
    borderRadius: 26,
    backgroundColor: '#E1D4FA',
    transform: [{ rotate: '-4deg' }],
    top: 26,
  },
  accentShapeWarm: {
    position: 'absolute',
    width: '70%',
    height: 145,
    borderRadius: 24,
    backgroundColor: '#F2B9A8',
    transform: [{ rotate: '5deg' }],
    top: 39,
    right: '15%',
  },
  challengeCard: {
    width: '86%',
    height: 160,
    borderRadius: 25,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.ink,
    shadowOpacity: 0.07,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  eyebrow: { color: COLORS.muted, fontSize: 11, letterSpacing: 0.2, fontWeight: '700' },
  challengeEquation: { marginTop: 22, color: COLORS.ink, fontSize: 39, fontWeight: '900', letterSpacing: 1 },
  sparkleLeft: { position: 'absolute', left: 12, top: 31, color: COLORS.purple, fontSize: 28 },
  sparkleRight: { position: 'absolute', right: 13, bottom: 8, color: COLORS.purple, fontSize: 25 },
  button: {
    minHeight: 54,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  buttonPrimary: { backgroundColor: COLORS.purple },
  buttonSecondary: { backgroundColor: COLORS.palePurple },
  buttonWhite: { backgroundColor: COLORS.white },
  buttonPressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontSize: 17, fontWeight: '800', textAlign: 'center' },
  buttonPrimaryText: { color: COLORS.white },
  buttonSecondaryText: { color: COLORS.ink },
  buttonWhiteText: { color: COLORS.ink },
  startButton: { marginTop: 'auto', minHeight: 56 },
  durationText: { marginTop: 16, color: COLORS.muted, textAlign: 'center', fontSize: 13 },
  recordsHomeButton: { marginTop: 65, minHeight: 55 },

  quizContent: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 28 },
  quizTopRow: { height: 48, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backButton: { width: 44, height: 44, borderRadius: 15, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' },
  backArrow: { color: COLORS.ink, fontSize: 32, lineHeight: 36, marginTop: -4 },
  backButtonSpacer: { width: 44, height: 44 },
  timerPill: { minWidth: 138, height: 48, borderRadius: 26, backgroundColor: COLORS.palePurple, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  timerIcon: { color: COLORS.purple, fontSize: 23 },
  timerText: { color: COLORS.purple, fontSize: 24, fontWeight: '800', fontVariant: ['tabular-nums'] },
  quizMetaRow: { marginTop: 22, flexDirection: 'row', justifyContent: 'center', gap: 12 },
  quizMeta: { color: COLORS.muted, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  scoreRow: { marginTop: 13, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  scoreText: { color: COLORS.ink, fontSize: 13, fontWeight: '700' },
  scoreSeparator: { color: '#C9C2D0', fontSize: 17 },
  headingPlaceholder: { height: 56 },
  listeningHeading: { height: 78, marginTop: 10, color: COLORS.ink, fontSize: 28, lineHeight: 34, fontWeight: '900', textAlign: 'center', textAlignVertical: 'center' },
  encouragement: { height: 56, textAlign: 'center', textAlignVertical: 'center', color: COLORS.ink, fontSize: 28, fontWeight: '900' },
  quickCorrect: { height: 56, textAlign: 'center', textAlignVertical: 'center', color: COLORS.green, fontSize: 24, fontWeight: '800' },
  questionCard: {
    minHeight: 292,
    marginTop: 2,
    borderRadius: 28,
    padding: 24,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'flex-start',
    shadowColor: COLORS.ink,
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 7 },
    elevation: 2,
  },
  questionCardWrong: { backgroundColor: COLORS.paleRed },
  questionEquation: { marginTop: 57, color: COLORS.ink, fontSize: 48, lineHeight: 58, fontWeight: '900', textAlign: 'center', letterSpacing: 0.3 },
  questionEquationWrong: { color: COLORS.red, marginTop: 50 },
  questionHint: { marginTop: 25, color: '#B7A5D4', fontSize: 30, fontWeight: '700' },
  answerFeedbackWrong: { flexDirection: 'row', alignItems: 'center', marginTop: 42, paddingHorizontal: 15, minHeight: 38, borderRadius: 20, backgroundColor: '#F3C9C6', gap: 8 },
  answerFeedbackIcon: { color: COLORS.red, fontSize: 21, fontWeight: '700' },
  answerFeedbackTextWrong: { color: COLORS.red, fontSize: 13, fontWeight: '700' },
  answerActionBlock: { marginTop: 'auto', paddingTop: 34 },
  recordButton: { minHeight: 56 },
  typedHint: { marginTop: 9, color: COLORS.purple, textAlign: 'center', fontSize: 13, textDecorationLine: 'underline' },
  voiceMessage: { marginBottom: 10, color: COLORS.red, textAlign: 'center', fontSize: 13, lineHeight: 19 },
  recordingActionBlock: { marginTop: 44, alignItems: 'stretch' },
  waveform: { height: 32, marginBottom: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  waveformBar: { width: 5, borderRadius: 4, backgroundColor: COLORS.purple },
  stopRecordingButton: { minHeight: 56, borderRadius: 20, backgroundColor: COLORS.ink, alignItems: 'center', justifyContent: 'center' },
  stopRecordingButtonText: { color: COLORS.white, fontSize: 16, fontWeight: '800' },
  listeningHint: { marginTop: 14, color: COLORS.purple, textAlign: 'center', fontSize: 13 },
  waitingBlock: { alignItems: 'center', marginTop: 42 },
  waitingText: { color: COLORS.ink, fontSize: 16, fontWeight: '700' },
  progressTrack: { marginTop: 16, width: '62%', height: 6, borderRadius: 5, backgroundColor: '#E6E0D7', overflow: 'hidden' },
  progressFill: { width: '67%', height: 6, backgroundColor: COLORS.purple, borderRadius: 5 },

  resultsContent: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 9, paddingBottom: 25 },
  screenHeader: { height: 48, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  screenHeaderTitle: { color: COLORS.ink, fontSize: 17, fontWeight: '800' },
  resultHero: { marginTop: 18, paddingHorizontal: 24, paddingTop: 22, paddingBottom: 21, borderRadius: 28, backgroundColor: COLORS.white, alignItems: 'center' },
  trophyBadge: { width: 72, height: 72, borderRadius: 25, backgroundColor: COLORS.yellow, alignItems: 'center', justifyContent: 'center' },
  trophy: { fontSize: 33 },
  resultHeadline: { marginTop: 18, color: COLORS.ink, fontSize: 32, fontWeight: '900' },
  resultDifficulty: { marginTop: 5, color: COLORS.muted, fontSize: 13, fontWeight: '600' },
  resultScoreRow: { flexDirection: 'row', gap: 12, width: '100%', marginTop: 25 },
  resultScoreCorrect: { flex: 1, height: 56, borderRadius: 16, backgroundColor: COLORS.paleGreen, alignItems: 'center', justifyContent: 'center' },
  resultScoreWrong: { flex: 1, height: 56, borderRadius: 16, backgroundColor: COLORS.paleRed, alignItems: 'center', justifyContent: 'center' },
  resultScoreText: { color: COLORS.green, fontSize: 15, fontWeight: '700' },
  resultScoreWrongText: { color: COLORS.red, fontSize: 15, fontWeight: '700' },
  resultScoreNumber: { color: COLORS.green, fontSize: 19, fontWeight: '900' },
  resultScoreWrongNumber: { color: COLORS.red, fontSize: 19, fontWeight: '900' },
  playAgainButton: { width: '100%', marginTop: 17 },
  saveWarning: { marginTop: 12, color: COLORS.red, textAlign: 'center', fontSize: 12 },
  sectionHeadingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 27, marginBottom: 9 },
  sectionTitle: { color: COLORS.ink, fontSize: 20, fontWeight: '800' },
  viewAll: { color: COLORS.purple, fontSize: 13, fontWeight: '700' },
  compactListHeader: { marginBottom: 8, paddingHorizontal: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  emptySessions: { color: COLORS.muted, fontSize: 13, lineHeight: 19 },

  recordsContent: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 9, paddingBottom: 21 },
  recordsHeadline: { marginTop: 25, color: COLORS.ink, fontSize: 33, lineHeight: 41, fontWeight: '900', letterSpacing: 0.1 },
  recordsSubhead: { marginTop: 5, color: COLORS.muted, fontSize: 13 },
  latestCard: { minHeight: 78, marginTop: 19, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 20, backgroundColor: COLORS.palePurple, flexDirection: 'row', alignItems: 'center', gap: 14 },
  latestIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' },
  latestCheck: { color: COLORS.purple, fontSize: 22, fontWeight: '700' },
  latestTextGroup: { flex: 1 },
  latestLabel: { color: COLORS.purple, fontSize: 9, fontWeight: '700', letterSpacing: 0.3 },
  latestScore: { marginTop: 4, color: COLORS.ink, fontSize: 19, fontWeight: '800' },
  listHeader: { marginTop: 22, marginBottom: 8, paddingHorizontal: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  listHeaderDate: { color: COLORS.muted, fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },
  listHeaderCount: { color: COLORS.muted, fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },
  sessionRow: { minHeight: 48, paddingHorizontal: 12, marginBottom: 6, borderRadius: 12, backgroundColor: COLORS.white, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sessionRowCompact: { minHeight: 54, backgroundColor: COLORS.white },
  sessionMain: { flex: 1, paddingRight: 8 },
  sessionDate: { color: COLORS.ink, fontSize: 12, fontWeight: '600' },
  sessionDifficulty: { marginTop: 3, color: COLORS.muted, fontSize: 10 },
  sessionCorrect: { color: COLORS.green, fontSize: 17, fontWeight: '800' },
  compactSessionScore: { fontSize: 17, fontWeight: '800' },
  compactSessionCorrect: { color: COLORS.green },
  compactSessionSeparator: { color: COLORS.muted },
  compactSessionWrong: { color: COLORS.red },
  emptyCard: { padding: 16, borderRadius: 16, backgroundColor: COLORS.white },
  emptyTitle: { color: COLORS.ink, fontSize: 16, fontWeight: '800', marginBottom: 4 },
  recordsBackButton: { marginTop: 17, minHeight: 52 },

  modalBackdrop: { flex: 1, padding: 24, backgroundColor: 'rgba(48, 35, 79, 0.34)', alignItems: 'center', justifyContent: 'center' },
  typedModalBackdrop: { flex: 1, padding: 24, backgroundColor: 'rgba(48, 35, 79, 0.18)', alignItems: 'center', justifyContent: 'center' },
  modalCard: { width: '100%', maxWidth: 390, borderRadius: 26, padding: 24, backgroundColor: COLORS.white, alignItems: 'stretch', shadowColor: COLORS.ink, shadowOpacity: 0.16, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  modalTitle: { color: COLORS.ink, textAlign: 'center', fontSize: 23, fontWeight: '900' },
  modalDescription: { marginTop: 10, marginBottom: 18, color: COLORS.muted, textAlign: 'center', fontSize: 14, lineHeight: 21 },
  levelChoices: { gap: 10 },
  levelChoice: { minHeight: 62, borderRadius: 16, paddingHorizontal: 17, backgroundColor: COLORS.palePurple, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  levelChoiceName: { color: COLORS.ink, fontSize: 16, fontWeight: '800' },
  levelChoiceTime: { color: COLORS.purple, fontSize: 16, fontWeight: '800' },
  levelCancelButton: { marginTop: 15 },
  answerInput: { minHeight: 56, borderWidth: 2, borderColor: '#DFD6EC', borderRadius: 16, paddingHorizontal: 16, color: COLORS.ink, backgroundColor: '#FCFAFE', fontSize: 20, fontWeight: '700', textAlign: 'center' },
  validationText: { marginTop: 8, color: COLORS.red, fontSize: 12, textAlign: 'center' },
  modalButtonRow: { marginTop: 19, flexDirection: 'row', gap: 10 },
});
