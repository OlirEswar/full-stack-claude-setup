import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, startSession } from '@/api/client';
import { QuestionView } from '@/components/questions';
import { FeedbackSheet, OutOfHearts, SessionHeader } from '@/components/session';
import { Button, ErrorState, LoadingState, Text } from '@/components/ui';
import { sessionSummaryCache } from '@/hooks/sessionSummaryCache';
import { useSession } from '@/hooks/useSession';
import { borders, colors, layout, spacing } from '@/theme/tokens';

/** The lesson player: header, question, Check, then the feedback sheet. */
export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionId = Number(id);
  const router = useRouter();
  const s = useSession(sessionId);
  const [practice, setPractice] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null });

  const exit = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  useEffect(() => {
    if (s.phase === 'complete' && s.summary) {
      sessionSummaryCache.set(sessionId, s.summary);
      router.replace({ pathname: '/session/summary', params: { sessionId: String(sessionId) } });
    }
  }, [s.phase, s.summary, sessionId, router]);

  const startPractice = async () => {
    setPractice({ busy: true, error: null });
    try {
      const res = await startSession({ kind: 'practice' });
      router.replace({ pathname: '/session/[id]', params: { id: String(res.session.id) } });
    } catch (e) {
      setPractice({
        busy: false,
        error: e instanceof ApiError && e.message ? e.message : 'Couldn’t start a practice session. Try again.',
      });
    }
  };

  const total = s.session?.total ?? s.question?.total ?? 0;
  const showHearts = s.session?.kind === 'lesson';

  let body;
  if (s.phase === 'loading') {
    body = <LoadingState label="Loading your lesson…" />;
  } else if (s.phase === 'completing' || s.phase === 'complete') {
    body = <LoadingState label="Tallying your XP…" />;
  } else if (s.phase === 'error') {
    body = (
      <ErrorState
        title={s.session ? 'Your results didn’t save yet' : 'This lesson didn’t load'}
        message={s.error ?? undefined}
        onRetry={s.retry}
      />
    );
  } else if (s.phase === 'failed') {
    body = (
      <OutOfHearts
        answered={s.answered}
        total={total}
        onPractice={() => void startPractice()}
        onExit={() => router.replace('/')}
        practiceBusy={practice.busy}
        practiceError={practice.error}
      />
    );
  }

  const header = (
    <View style={styles.column}>
      <SessionHeader answered={s.answered} total={total} hearts={showHearts ? s.hearts : undefined} onClose={exit} />
    </View>
  );

  if (body) {
    return (
      <SafeAreaView style={styles.root} testID="session-screen">
        {s.session && s.phase !== 'failed' ? header : null}
        <View style={[styles.column, styles.flex]}>{body}</View>
      </SafeAreaView>
    );
  }

  const inFeedback = s.phase === 'feedback' && !!s.result;
  return (
    <SafeAreaView style={styles.root} testID="session-screen" edges={inFeedback ? ['top', 'left', 'right'] : undefined}>
      {header}
      <ScrollView style={styles.flex} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.column}>
          {s.question ? (
            <QuestionView
              question={s.question}
              onChange={s.select}
              disabled={s.phase === 'checking'}
              reveal={s.result ? { correct: s.result.correct, correctAnswer: s.result.correctAnswer } : undefined}
            />
          ) : null}
        </View>
      </ScrollView>
      {inFeedback && s.result ? (
        <SafeAreaView edges={['bottom']} style={{ backgroundColor: s.result.correct ? colors.success.tint : colors.error.tint }}>
          <FeedbackSheet result={s.result} onContinue={() => void s.next()} costsHeart={showHearts} />
        </SafeAreaView>
      ) : (
        <View style={styles.footer}>
          <View style={styles.column}>
            {s.error ? (
              <Text variant="caption" tone="error" align="center" style={styles.footerError}>
                {s.error}
              </Text>
            ) : null}
            <Button
              label="Check"
              onPress={() => void s.check()}
              disabled={!s.response}
              loading={s.phase === 'checking'}
              testID="check-button"
            />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  column: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.md,
  },
  scroll: { flexGrow: 1, paddingBottom: spacing.xl, paddingTop: spacing.lg },
  footer: {
    paddingBottom: spacing.lg,
    borderTopWidth: borders.width,
    borderTopColor: colors.border,
  },
  footerError: { marginBottom: spacing.sm },
});
