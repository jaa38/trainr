import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import { Card } from '../index';
import { TrainrThemeProvider } from '../../../theme/ThemeProvider';

type CardTestProps = Omit<React.ComponentProps<typeof Card>, 'children'>;

async function renderCard(props: CardTestProps = {}) {
  return render(
    <TrainrThemeProvider>
      <Card {...props}>
        <Text>Card content</Text>
      </Card>
    </TrainrThemeProvider>,
  );
}

describe('Card', () => {
  it('renders its children', async () => {
    const { getByText } = await renderCard();

    expect(getByText('Card content')).toBeTruthy();
  });

  it('renders the default variant', async () => {
    const { getByText } = await renderCard();

    expect(getByText('Card content')).toBeTruthy();
  });

  it.each(['default', 'elevated', 'outlined', 'interactive'] as const)(
    'renders the %s variant',
    async (variant) => {
      const { getByText } = await renderCard({ variant });

      expect(getByText('Card content')).toBeTruthy();
    },
  );

  it('renders as a button when onPress is supplied', async () => {
    const { getByRole } = await renderCard({ onPress: jest.fn() });

    expect(getByRole('button')).toBeTruthy();
  });

  it('calls onPress when pressed', async () => {
    const onPress = jest.fn();
    const { getByRole } = await renderCard({ onPress });

    fireEvent.press(getByRole('button'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('exposes the supplied accessibility label', async () => {
    const { getByLabelText } = await renderCard({
      onPress: jest.fn(),
      accessibilityLabel: 'Open workout details',
    });

    expect(getByLabelText('Open workout details')).toBeTruthy();
  });

  it('renders as a non-interactive container without onPress', async () => {
    const { queryByRole, getByText } = await renderCard();

    expect(getByText('Card content')).toBeTruthy();
    expect(queryByRole('button')).toBeNull();
  });

  it('supports custom styles', async () => {
    const { getByText } = await renderCard({
      style: { marginTop: 16 },
    });

    expect(getByText('Card content')).toBeTruthy();
  });
});
