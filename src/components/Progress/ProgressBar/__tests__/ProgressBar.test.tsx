import React from 'react';
import { render } from '@testing-library/react-native';

import { ProgressBar } from '../index';
import { TrainrThemeProvider } from '../../../../theme/ThemeProvider';

async function renderProgressBar(props: React.ComponentProps<typeof ProgressBar>) {
  return render(
    <TrainrThemeProvider>
      <ProgressBar {...props} />
    </TrainrThemeProvider>,
  );
}

describe('ProgressBar', () => {
  it.each([
    [0, 0],
    [0.25, 25],
    [0.5, 50],
    [1, 100],
  ])('exposes progress %s as %s percent', async (progress, expected) => {
    const { getByRole } = await renderProgressBar({ progress });

    expect(getByRole('progressbar').props.accessibilityValue).toEqual({
      min: 0,
      max: 100,
      now: expected,
    });
  });

  it('clamps progress below zero', async () => {
    const { getByRole } = await renderProgressBar({ progress: -0.5 });

    expect(getByRole('progressbar').props.accessibilityValue.now).toBe(0);
  });

  it('clamps progress above one', async () => {
    const { getByRole } = await renderProgressBar({ progress: 1.5 });

    expect(getByRole('progressbar').props.accessibilityValue.now).toBe(100);
  });

  it('supports a custom height', async () => {
    const { getByRole } = await renderProgressBar({
      progress: 0.5,
      height: 12,
    });

    expect(getByRole('progressbar').props.style.height).toBe(12);
  });

  it('accepts a custom progress colour', async () => {
    const { getByRole } = await renderProgressBar({
      progress: 0.5,
      color: '#D71920',
    });

    expect(getByRole('progressbar')).toBeTruthy();
  });
});
