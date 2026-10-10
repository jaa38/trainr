import React from 'react';
import { render } from '@testing-library/react-native';

import { ProgressRing } from '../index';
import { TrainrThemeProvider } from '../../../../theme/ThemeProvider';

async function renderProgressRing(props: React.ComponentProps<typeof ProgressRing>) {
  return render(
    <TrainrThemeProvider>
      <ProgressRing {...props} />
    </TrainrThemeProvider>,
  );
}

describe('ProgressRing', () => {
  it('renders as an accessible progress indicator', async () => {
    const { getByRole } = await renderProgressRing({ progress: 0.5 });

    expect(getByRole('progressbar')).toBeTruthy();
    expect(getByRole('progressbar').props.accessibilityValue).toEqual({
      min: 0,
      max: 100,
      now: 50,
    });
  });

  it.each([
    [0, 0],
    [0.25, 25],
    [0.5, 50],
    [1, 100],
  ])('exposes progress %s as %s percent', async (progress, expected) => {
    const { getByRole } = await renderProgressRing({ progress });

    expect(getByRole('progressbar').props.accessibilityValue.now).toBe(expected);
  });

  it('clamps progress below zero', async () => {
    const { getByRole } = await renderProgressRing({ progress: -0.5 });

    expect(getByRole('progressbar').props.accessibilityValue.now).toBe(0);
  });

  it('clamps progress above one', async () => {
    const { getByRole } = await renderProgressRing({ progress: 1.5 });

    expect(getByRole('progressbar').props.accessibilityValue.now).toBe(100);
  });

  it('renders a custom value', async () => {
    const { getByText } = await renderProgressRing({
      progress: 0.75,
      value: '75%',
    });

    expect(getByText('75%')).toBeTruthy();
  });

  it('renders a custom label', async () => {
    const { getByText } = await renderProgressRing({
      progress: 0.5,
      label: 'Weekly goal',
    });

    expect(getByText('Weekly goal')).toBeTruthy();
  });

  it('supports a custom size and stroke width', async () => {
    const { getByRole } = await renderProgressRing({
      progress: 0.5,
      size: 160,
      strokeWidth: 12,
    });

    expect(getByRole('progressbar')).toBeTruthy();
  });

  it('accepts a custom progress colour', async () => {
    const { getByRole } = await renderProgressRing({
      progress: 0.5,
      color: '#D71920',
    });

    expect(getByRole('progressbar')).toBeTruthy();
  });

  it('renders without an optional value or label', async () => {
    const { getByRole, queryByText } = await renderProgressRing({
      progress: 0.5,
    });

    expect(getByRole('progressbar')).toBeTruthy();
    expect(queryByText('Weekly goal')).toBeNull();
  });
});
