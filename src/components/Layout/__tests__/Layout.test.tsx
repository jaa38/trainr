import React from 'react';
import { render } from '@testing-library/react-native';
import { View } from 'react-native';

import { Row, Spacer, Stack } from '../index';
import { TrainrThemeProvider } from '../../../theme/ThemeProvider';

async function renderWithTheme(children: React.ReactNode) {
  return render(<TrainrThemeProvider>{children}</TrainrThemeProvider>);
}

describe('Stack', () => {
  it('renders its children', async () => {
    const { getByTestId } = await renderWithTheme(
      <Stack>
        <View testID="stack-child" />
      </Stack>,
    );

    expect(getByTestId('stack-child')).toBeTruthy();
  });

  it('supports a custom gap', async () => {
    const { toJSON } = await renderWithTheme(
      <Stack gap={24}>
        <View />
      </Stack>,
    );

    expect(JSON.stringify(toJSON())).toContain('"gap":24');
  });

  it('supports custom styles', async () => {
    const { toJSON } = await renderWithTheme(
      <Stack style={{ marginTop: 12 }}>
        <View />
      </Stack>,
    );

    expect(JSON.stringify(toJSON())).toContain('"marginTop":12');
  });
});

describe('Row', () => {
  it('renders its children', async () => {
    const { getByTestId } = await renderWithTheme(
      <Row>
        <View testID="row-child" />
      </Row>,
    );

    expect(getByTestId('row-child')).toBeTruthy();
  });

  it('supports a custom gap', async () => {
    const { toJSON } = await renderWithTheme(
      <Row gap={20}>
        <View />
      </Row>,
    );

    expect(JSON.stringify(toJSON())).toContain('"gap":20');
  });

  it('supports custom styles', async () => {
    const { toJSON } = await renderWithTheme(
      <Row style={{ marginBottom: 8 }}>
        <View />
      </Row>,
    );

    expect(JSON.stringify(toJSON())).toContain('"marginBottom":8');
  });
});

describe('Spacer', () => {
  it('renders successfully with the default size', async () => {
    const { toJSON } = await renderWithTheme(<Spacer />);

    expect(toJSON()).toBeTruthy();
  });

  it('supports a custom spacing size', async () => {
    const { toJSON } = await renderWithTheme(<Spacer size="xl" />);

    expect(toJSON()).toBeTruthy();
  });
});
