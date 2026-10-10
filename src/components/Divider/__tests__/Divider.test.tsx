import React from 'react';
import { render } from '@testing-library/react-native';

import { Divider } from '../index';
import { TrainrThemeProvider } from '../../../theme/ThemeProvider';

async function renderDivider() {
  return render(
    <TrainrThemeProvider>
      <Divider />
    </TrainrThemeProvider>,
  );
}

describe('Divider', () => {
  it('renders successfully', async () => {
    const { toJSON } = await renderDivider();

    expect(toJSON()).toBeTruthy();
  });

  it('renders a native view', async () => {
    const { toJSON } = await renderDivider();
    const renderedDivider = toJSON();

    expect(renderedDivider).toHaveProperty('type', 'View');
  });
});
