import { fireEvent, render, screen } from '@testing-library/react-native';

import { Button, EmptyState, ErrorState, ProgressBar, StatPill } from '@/components/ui';
import { colors, ink, palette, tokens } from '@/theme';

describe('ui primitives', () => {
  it('Button renders label and fires onPress', async () => {
    const onPress = jest.fn();
    await render(<Button label="Check" onPress={onPress} />);
    fireEvent.press(screen.getByText('Check'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Check' })).toBeTruthy();
  });

  it('Button disabled does not fire onPress', async () => {
    const onPress = jest.fn();
    await render(<Button label="Check" onPress={onPress} disabled />);
    fireEvent.press(screen.getByText('Check'));
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
  });

  it('ProgressBar exposes accessibilityValue {now, max}', async () => {
    await render(<ProgressBar value={3} max={10} testID="bar" />);
    expect(screen.getByTestId('bar').props.accessibilityValue).toMatchObject({ now: 3, max: 10 });
    expect(screen.getByRole('progressbar')).toBeTruthy();
  });

  it('ProgressBar clamps out-of-range values', async () => {
    await render(<ProgressBar value={14} max={10} testID="bar" />);
    expect(screen.getByTestId('bar').props.accessibilityValue).toMatchObject({ now: 10, max: 10 });
  });

  it('StatPill renders streak count', async () => {
    await render(<StatPill kind="streak" value={12} />);
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByLabelText('12 day streak')).toBeTruthy();
  });

  it('EmptyState and ErrorState render copy and actions', async () => {
    const onRetry = jest.fn();
    await render(
      <>
        <EmptyState title="No reviews due" message="Your loop is stable." />
        <ErrorState onRetry={onRetry} />
      </>,
    );
    expect(screen.getByText('No reviews due')).toBeTruthy();
    fireEvent.press(screen.getByText('Try again'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('tokens has no stock default palette', () => {
    const stock = ['#007AFF', '#2563EB', '#3B82F6', '#18181B', '#0F172A', '#71717A', '#64748B'];
    expect(stock).not.toContain(colors.primary.base.toUpperCase());
    expect(stock).not.toContain(palette.primary.base.toUpperCase());
    for (const v of Object.values(ink)) expect(stock).not.toContain(v.toUpperCase());
    // semantic + gamification colors all present
    for (const key of ['success', 'error', 'warning', 'streak', 'xp', 'heart'] as const) {
      expect(palette[key].base).toMatch(/^#[0-9A-F]{6}$/i);
      expect(palette[key].shade).not.toBe(palette[key].base);
    }
    expect(tokens.layout.maxContentWidth).toBe(640);
  });
});
