import React from 'react';
import { render } from '@testing-library/react-native';

import { Avatar } from '../index';
import { TrainrThemeProvider } from '../../../theme/ThemeProvider';

type AvatarTestProps = React.ComponentProps<typeof Avatar>;

async function renderAvatar(props: AvatarTestProps = {}) {
  return render(
    <TrainrThemeProvider>
      <Avatar {...props} />
    </TrainrThemeProvider>,
  );
}

describe('Avatar', () => {
  it('renders a question mark when no name is provided', async () => {
    const { getByText, getByLabelText } = await renderAvatar();

    expect(getByText('?')).toBeTruthy();
    expect(getByLabelText('? avatar')).toBeTruthy();
  });

  it('renders the first initial of the supplied name', async () => {
    const { getByText } = await renderAvatar({ name: 'Jeremiah Akinsowon' });

    expect(getByText('J')).toBeTruthy();
  });

  it('trims whitespace and capitalises the initial', async () => {
    const { getByText } = await renderAvatar({ name: '  jeremiah  ' });

    expect(getByText('J')).toBeTruthy();
  });

  it('falls back to a question mark for a whitespace-only name', async () => {
    const { getByText, getByLabelText } = await renderAvatar({ name: '   ' });

    expect(getByText('?')).toBeTruthy();
    expect(getByLabelText('   avatar')).toBeTruthy();
  });

  it('uses the default avatar size of 48', async () => {
    const { getByLabelText } = await renderAvatar({ name: 'Jeremiah' });
    const avatar = getByLabelText('Jeremiah avatar');

    expect(avatar.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          width: 48,
          height: 48,
          borderRadius: 24,
        }),
      ]),
    );
  });

  it('supports a custom avatar size', async () => {
    const { getByLabelText } = await renderAvatar({
      name: 'Jeremiah',
      size: 64,
    });
    const avatar = getByLabelText('Jeremiah avatar');

    expect(avatar.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          width: 64,
          height: 64,
          borderRadius: 32,
        }),
      ]),
    );
  });

  it('renders a profile image when a URI is provided', async () => {
    const { getByLabelText } = await renderAvatar({
      name: 'Jeremiah',
      uri: 'https://example.com/profile.jpg',
    });

    expect(getByLabelText('Jeremiah profile photo')).toBeTruthy();
  });

  it('does not render initials when a profile image is provided', async () => {
    const { queryByText } = await renderAvatar({
      name: 'Jeremiah',
      uri: 'https://example.com/profile.jpg',
    });

    expect(queryByText('J')).toBeNull();
  });
});
