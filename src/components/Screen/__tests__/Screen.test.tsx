import React from 'react';
import { render } from '@testing-library/react-native';
import { View } from 'react-native';

import { Screen } from '../index';
import { TrainrThemeProvider } from '../../../theme/ThemeProvider';

type ScreenTestProps = Omit<React.ComponentProps<typeof Screen>, 'children'>;

async function renderScreen(props: ScreenTestProps = {}) {
  return render(
    <TrainrThemeProvider>
      <Screen {...props}>
        <View testID="screen-content" />
      </Screen>
    </TrainrThemeProvider>,
  );
}

describe('Screen', () => {
  it('renders its children', async () => {
    const { getByTestId } = await renderScreen();

    expect(getByTestId('screen-content')).toBeTruthy();
  });

  it('renders successfully with scrolling enabled', async () => {
    const { getByTestId } = await renderScreen({ scroll: true });

    expect(getByTestId('screen-content')).toBeTruthy();
  });

  it('renders successfully with keyboard avoidance enabled', async () => {
    const { getByTestId } = await renderScreen({
      keyboardAvoiding: true,
    });

    expect(getByTestId('screen-content')).toBeTruthy();
  });

  it('supports scrolling and keyboard avoidance together', async () => {
    const { getByTestId } = await renderScreen({
      scroll: true,
      keyboardAvoiding: true,
    });

    expect(getByTestId('screen-content')).toBeTruthy();
  });

  it('supports custom container styles', async () => {
    const { getByTestId } = await renderScreen({
      contentContainerStyle: { marginTop: 16 },
    });

    expect(getByTestId('screen-content')).toBeTruthy();
  });

  it('supports a custom screen style', async () => {
    const { getByTestId } = await renderScreen({
      style: { opacity: 0.9 },
    });

    expect(getByTestId('screen-content')).toBeTruthy();
  });

  it('renders children when horizontal padding is disabled', async () => {
    const { getByTestId } = await renderScreen({ padded: false });

    expect(getByTestId('screen-content')).toBeTruthy();
  });
});
