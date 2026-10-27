import type { QuestionResponse } from '@/api/types';

/**
 * Feedback state passed in after Check (task 24). `correctAnswer` is the answer key in
 * display order, exactly as the server's `AnswerResult.correctAnswer` sends it.
 */
export type Reveal<A> = {
  correct: boolean;
  correctAnswer: A;
};

/** Props shared by every question input. `onChange(null)` means "not answerable yet". */
export type InputProps<R extends QuestionResponse, A> = {
  onChange: (response: R | null) => void;
  /** Freeze the input (after Check). Implied by `reveal`. */
  disabled?: boolean;
  reveal?: Reveal<A>;
  /** Enable number-key shortcuts on web (default true). */
  shortcuts?: boolean;
  testID?: string;
};
