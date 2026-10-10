import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { Button } from '../index';
import { TrainrThemeProvider } from '../../../theme/ThemeProvider';

type ButtonTestProps = Omit<React.ComponentProps<typeof Button>, 'children'>;

async function renderButton(props: ButtonTestProps = {}) {
  return render(
    <TrainrThemeProvider>
      <Button {...props}>Continue</Button>
    </TrainrThemeProvider>,
  );
}

describe('Button', () => {
  it('renders its label', async () => {
    const { getByText } = await renderButton();

    expect(getByText('Continue')).toBeTruthy();
  });

  it('calls onPress when pressed', async () => {
    const onPress = jest.fn();
    const { getByRole } = await renderButton({ onPress });

    fireEvent.press(getByRole('button'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it.each(['primary', 'secondary', 'outline', 'ghost', 'destructive'] as const)(
    'renders the %s variant',
    async (variant) => {
      const { getByRole, getByText } = await renderButton({ variant });

      expect(getByRole('button')).toBeTruthy();
      expect(getByText('Continue')).toBeTruthy();
    },
  );

  it('does not call onPress when disabled', async () => {
    const onPress = jest.fn();
    const { getByRole } = await renderButton({
      onPress,
      disabled: true,
    });

    expect(getByRole('button').props.accessibilityState.disabled).toBe(true);

    fireEvent.press(getByRole('button'));

    expect(onPress).not.toHaveBeenCalled();
  });

  it('shows its busy state and prevents interaction while loading', async () => {
    const onPress = jest.fn();
    const { getByRole, queryByText } = await renderButton({
      onPress,
      loading: true,
    });

    expect(getByRole('button').props.accessibilityState.busy).toBe(true);
    expect(getByRole('button').props.accessibilityState.disabled).toBe(true);
    expect(queryByText('Continue')).toBeNull();

    fireEvent.press(getByRole('button'));

    expect(onPress).not.toHaveBeenCalled();
  });
});
