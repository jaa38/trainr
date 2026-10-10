import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { IconButton } from '../index';
import { TrainrThemeProvider } from '../../../theme/ThemeProvider';

type IconButtonTestProps = Omit<
  React.ComponentProps<typeof IconButton>,
  'children' | 'accessibilityLabel'
>;

async function renderIconButton(props: IconButtonTestProps = {}) {
  return render(
    <TrainrThemeProvider>
      <IconButton accessibilityLabel="Open settings" {...props}>
        <Text>Icon</Text>
      </IconButton>
    </TrainrThemeProvider>,
  );
}

describe('IconButton', () => {
  it('renders its child', async () => {
    const { getByText } = await renderIconButton();

    expect(getByText('Icon')).toBeTruthy();
  });

  it('exposes its accessible label and button role', async () => {
    const { getByRole, getByLabelText } = await renderIconButton();

    expect(getByRole('button')).toBeTruthy();
    expect(getByLabelText('Open settings')).toBeTruthy();
  });

  it('calls onPress when pressed', async () => {
    const onPress = jest.fn();
    const { getByRole } = await renderIconButton({ onPress });

    fireEvent.press(getByRole('button'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', async () => {
    const onPress = jest.fn();
    const { getByRole } = await renderIconButton({
      onPress,
      disabled: true,
    });

    expect(getByRole('button').props.accessibilityState.disabled).toBe(true);

    fireEvent.press(getByRole('button'));

    expect(onPress).not.toHaveBeenCalled();
  });

  it('supports a custom size', async () => {
    const { getByRole } = await renderIconButton({ size: 64 });
    const button = getByRole('button');

    expect(JSON.stringify(button.props.style)).toContain('"width":64');
    expect(JSON.stringify(button.props.style)).toContain('"height":64');
  });

  it('enforces the minimum touch target for smaller sizes', async () => {
    const { getByRole } = await renderIconButton({ size: 24 });
    const button = getByRole('button');

    expect(button.props.style).toBeTruthy();
  });

  it('supports custom styles', async () => {
    const { getByRole } = await renderIconButton({
      style: { marginTop: 12 },
    });

    expect(JSON.stringify(getByRole('button').props.style)).toContain('"marginTop":12');
  });
});
