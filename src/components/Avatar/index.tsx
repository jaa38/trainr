import { Image, View } from 'react-native';

import { useTrainrTheme } from '../../theme/ThemeProvider';
import { AppText } from '../AppText';

type Props = {
  uri?: string;
  name?: string;
  size?: number;
};

export function Avatar({ uri, name = '?', size = 48 }: Props) {
  const theme = useTrainrTheme();
  const initials = name.trim().charAt(0).toUpperCase() || '?';

  const avatarStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  if (uri) {
    return (
      <Image
        source={{ uri }}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`${name} profile photo`}
        style={avatarStyle}
      />
    );
  }

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${name} avatar`}
      style={[
        avatarStyle,
        {
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.surfaceSecondary,
        },
      ]}
    >
      <AppText variant="bodyMedium" color={theme.colors.text.primary}>
        {initials}
      </AppText>
    </View>
  );
}
