import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { AppText } from '@/components/AppText';
import { useTrainrTheme } from '@/theme';

type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  scrollable?: boolean;
  maxHeight?: number | `${number}%`;
  contentStyle?: StyleProp<ViewStyle>;
  scrollViewProps?: ScrollViewProps;
  testID?: string;
};

export function BottomSheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
  scrollable = true,
  maxHeight = '85%',
  contentStyle,
  scrollViewProps,
  testID,
}: BottomSheetProps) {
  const theme = useTrainrTheme();
  const { colors, spacing } = theme;

  const content = scrollable ? (
    <ScrollView
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        {
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: spacing.xl,
          gap: spacing.md,
        },
        contentStyle,
      ]}
      {...scrollViewProps}
    >
      {children}
    </ScrollView>
  ) : (
    <View
      style={[
        {
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: spacing.xl,
          gap: spacing.md,
        },
        contentStyle,
      ]}
    >
      {children}
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
      testID={testID}
    >
      <View
        style={{
          flex: 1,
          justifyContent: 'flex-end',
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close bottom sheet"
          onPress={onClose}
          style={{
            ...({
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
            } as const),
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
          }}
        />

        <View
          accessibilityViewIsModal
          style={{
            maxHeight,
            width: '100%',
            overflow: 'hidden',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            backgroundColor: colors.background.primary,
            borderWidth: 1,
            borderColor: colors.border.default,
            paddingBottom: spacing.lg,
          }}
        >
          <View
            style={{
              alignItems: 'center',
              paddingTop: spacing.sm,
              paddingBottom: spacing.md,
            }}
          >
            <View
              style={{
                width: 40,
                height: 5,
                borderRadius: 999,
                backgroundColor: colors.border.default,
              }}
            />
          </View>

          <View
            style={{
              paddingHorizontal: spacing.lg,
              paddingBottom: spacing.md,
              gap: spacing.xs,
              borderBottomWidth: 1,
              borderBottomColor: colors.border.default,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: spacing.md,
              }}
            >
              <View style={{ flex: 1 }}>
                <AppText variant="h2" color={colors.text.primary}>
                  {title}
                </AppText>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close bottom sheet"
                hitSlop={10}
                onPress={onClose}
                style={{
                  minWidth: 44,
                  minHeight: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 22,
                  backgroundColor: colors.background.secondary,
                }}
              >
                <AppText variant="h3" color={colors.text.primary}>
                  ×
                </AppText>
              </Pressable>
            </View>

            {subtitle ? (
              <AppText variant="bodySmall" color={colors.text.secondary}>
                {subtitle}
              </AppText>
            ) : null}
          </View>

          {content}

          {footer ? (
            <View
              style={{
                paddingHorizontal: spacing.lg,
                paddingTop: spacing.md,
                borderTopWidth: 1,
                borderTopColor: colors.border.default,
              }}
            >
              {footer}
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
