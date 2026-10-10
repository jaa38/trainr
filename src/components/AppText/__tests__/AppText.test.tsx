import React from 'react';
import { render } from '@testing-library/react-native';

import { AppText } from '../index';
import { TrainrThemeProvider } from '../../../theme/ThemeProvider';

async function renderAppText(props: React.ComponentProps<typeof AppText> = {}) {
  return render(
    <TrainrThemeProvider>
      <AppText {...props}>TRAINR text</AppText>
    </TrainrThemeProvider>,
  );
}

describe('AppText', () => {
  it('renders its children', async () => {
    const { getByText } = await renderAppText();

    expect(getByText('TRAINR text')).toBeTruthy();
  });

  it('renders with the default typography variant', async () => {
    const { getByText } = await renderAppText();

    expect(getByText('TRAINR text')).toBeTruthy();
  });

  it.each([
    'displayXL',
    'displayLarge',
    'displayMedium',
    'h1',
    'h2',
    'h3',
    'h4',
    'bodyLarge',
    'body',
    'caption',
    'buttonLarge',
    'button',
    'label',
    'metricXL',
    'metricLarge',
    'metricMedium',
  ] as const)('supports the %s typography variant', async (variant) => {
    const { getByText } = await renderAppText({ variant });

    expect(getByText('TRAINR text')).toBeTruthy();
  });

  it('supports a custom text colour', async () => {
    const { getByText } = await renderAppText({ color: '#D71920' });

    expect(getByText('TRAINR text')).toBeTruthy();
  });

  it('supports text alignment', async () => {
    const { getByText } = await renderAppText({ align: 'center' });

    expect(getByText('TRAINR text')).toBeTruthy();
  });

  it('supports a custom font weight', async () => {
    const { getByText } = await renderAppText({ weight: '700' });

    expect(getByText('TRAINR text')).toBeTruthy();
  });

  it('supports custom text styles', async () => {
    const { getByText } = await renderAppText({
      style: { letterSpacing: 1 },
    });

    expect(getByText('TRAINR text')).toBeTruthy();
  });
});
