import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { EmptyState, ErrorState, Loading } from '../index';
import { TrainrThemeProvider } from '../../../../theme/ThemeProvider';

async function renderWithTheme(children: React.ReactNode) {
  return render(<TrainrThemeProvider>{children}</TrainrThemeProvider>);
}

describe('Loading', () => {
  it('renders the default loading label', async () => {
    const { getByText, getByLabelText } = await renderWithTheme(<Loading />);

    expect(getByText('Loading')).toBeTruthy();
    expect(getByLabelText('Loading')).toBeTruthy();
  });

  it('renders a custom loading label', async () => {
    const { getByText, getByLabelText } = await renderWithTheme(
      <Loading label="Loading workouts" />,
    );

    expect(getByText('Loading workouts')).toBeTruthy();
    expect(getByLabelText('Loading workouts')).toBeTruthy();
  });
});

describe('EmptyState', () => {
  it('renders its title', async () => {
    const { getByText } = await renderWithTheme(<EmptyState title="No workouts yet" />);

    expect(getByText('No workouts yet')).toBeTruthy();
  });

  it('renders an optional message', async () => {
    const { getByText } = await renderWithTheme(
      <EmptyState title="No workouts yet" message="Your workouts will appear here." />,
    );

    expect(getByText('Your workouts will appear here.')).toBeTruthy();
  });

  it('renders and invokes its action when both action props are supplied', async () => {
    const onAction = jest.fn();
    const { getByRole, getByText } = await renderWithTheme(
      <EmptyState
        title="No workouts yet"
        actionLabel="Create workout"
        onAction={onAction}
      />,
    );

    expect(getByText('Create workout')).toBeTruthy();
    fireEvent.press(getByRole('button'));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('does not render an action when no callback is supplied', async () => {
    const { queryByText } = await renderWithTheme(
      <EmptyState title="No workouts yet" actionLabel="Create workout" />,
    );

    expect(queryByText('Create workout')).toBeNull();
  });
});

describe('ErrorState', () => {
  it('renders its title and optional message', async () => {
    const { getByText } = await renderWithTheme(
      <ErrorState
        title="Unable to load workouts"
        message="Check your connection and try again."
      />,
    );

    expect(getByText('Unable to load workouts')).toBeTruthy();
    expect(getByText('Check your connection and try again.')).toBeTruthy();
  });

  it('uses the default action label when a callback is supplied', async () => {
    const onAction = jest.fn();
    const { getByText } = await renderWithTheme(
      <ErrorState title="Something went wrong" onAction={onAction} />,
    );

    expect(getByText('Try Again')).toBeTruthy();
  });

  it('invokes its action when pressed', async () => {
    const onAction = jest.fn();
    const { getByRole } = await renderWithTheme(
      <ErrorState title="Something went wrong" actionLabel="Retry" onAction={onAction} />,
    );

    fireEvent.press(getByRole('button'));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('does not render an action when no callback is supplied', async () => {
    const { queryByText } = await renderWithTheme(
      <ErrorState title="Something went wrong" actionLabel="Retry" />,
    );

    expect(queryByText('Retry')).toBeNull();
  });
});
