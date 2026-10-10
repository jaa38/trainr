import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { TrainrThemeProvider } from '../../../theme/ThemeProvider';
import { Input } from '../index';

type InputTestProps = React.ComponentProps<typeof Input>;

async function renderInput(props: InputTestProps = {}) {
  return render(
    <TrainrThemeProvider>
      <Input {...props} testID="trainr-input" />
    </TrainrThemeProvider>,
  );
}

describe('Input', () => {
  it('renders a text input', async () => {
    const { getByTestId } = await renderInput();

    expect(getByTestId('trainr-input')).toBeTruthy();
  });

  it('uses its label as the accessibility label', async () => {
    const { getByLabelText } = await renderInput({
      label: 'Email address',
    });

    expect(getByLabelText('Email address')).toBeTruthy();
  });

  it('uses an explicit accessibility label when provided', async () => {
    const { getByLabelText } = await renderInput({
      label: 'Email',
      accessibilityLabel: 'Your email address',
    });

    expect(getByLabelText('Your email address')).toBeTruthy();
  });

  it('displays helper text', async () => {
    const { getByText } = await renderInput({
      helperText: 'Enter the email associated with your account.',
    });

    expect(getByText('Enter the email associated with your account.')).toBeTruthy();
  });

  it('displays an error message', async () => {
    const { getByText } = await renderInput({
      error: 'Please enter a valid email address.',
    });

    expect(getByText('Please enter a valid email address.')).toBeTruthy();
  });

  it('shows the error instead of helper text when both are provided', async () => {
    const { getByText, queryByText } = await renderInput({
      error: 'Invalid email address.',
      helperText: 'Enter your email address.',
    });

    expect(getByText('Invalid email address.')).toBeTruthy();
    expect(queryByText('Enter your email address.')).toBeNull();
  });

  it('passes the entered text to onChangeText', async () => {
    const onChangeText = jest.fn();
    const { getByTestId } = await renderInput({ onChangeText });

    fireEvent.changeText(getByTestId('trainr-input'), 'user@example.com');

    expect(onChangeText).toHaveBeenCalledWith('user@example.com');
  });

  it('calls onFocus when focused', async () => {
    const onFocus = jest.fn();
    const { getByTestId } = await renderInput({ onFocus });

    fireEvent(getByTestId('trainr-input'), 'focus');

    expect(onFocus).toHaveBeenCalledTimes(1);
  });

  it('calls onBlur when blurred', async () => {
    const onBlur = jest.fn();
    const { getByTestId } = await renderInput({ onBlur });

    fireEvent(getByTestId('trainr-input'), 'blur');

    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it('supports a placeholder', async () => {
    const { getByPlaceholderText } = await renderInput({
      placeholder: 'Enter your email',
    });

    expect(getByPlaceholderText('Enter your email')).toBeTruthy();
  });
});
