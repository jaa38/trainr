import { render } from '@testing-library/react-native';
import React from 'react';

import { TrainrThemeProvider } from '../../../theme/ThemeProvider';
import { Badge } from '../index';

type BadgeTestProps = Omit<React.ComponentProps<typeof Badge>, 'children'>;

async function renderBadge(props: BadgeTestProps = {}) {
  return render(
    <TrainrThemeProvider>
      <Badge {...props}>Active</Badge>
    </TrainrThemeProvider>,
  );
}

describe('Badge', () => {
  it('renders its label', async () => {
    const { getByText } = await renderBadge();

    expect(getByText('Active')).toBeTruthy();
  });

  it('uses the neutral tone by default', async () => {
    const { getByText } = await renderBadge();

    expect(getByText('Active')).toBeTruthy();
  });

  it.each(['neutral', 'primary', 'success', 'warning', 'error', 'info'] as const)(
    'renders the %s tone',
    async (tone) => {
      const { getByText } = await renderBadge({ tone });

      expect(getByText('Active')).toBeTruthy();
    },
  );

  it('exposes the supplied accessibility label', async () => {
    const { getByLabelText } = await renderBadge({
      accessibilityLabel: 'Account status: active',
    });

    expect(getByLabelText('Account status: active')).toBeTruthy();
  });

  it('exposes the supplied accessibility label', async () => {
    const { getByLabelText } = await renderBadge({
      accessibilityLabel: 'Account status: active',
    });

    expect(getByLabelText('Account status: active')).toBeTruthy();
  });
});
