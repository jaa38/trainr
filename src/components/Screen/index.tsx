import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import { useTrainrTheme } from "../../theme/ThemeProvider";

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  keyboardAvoiding?: boolean;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

export function Screen({
  children,
  scroll = false,
  keyboardAvoiding = false,
  padded = true,
  style,
  contentContainerStyle,
}: Props) {
  const theme = useTrainrTheme();

  const content = scroll ? (
    <ScrollView
      contentContainerStyle={[
        padded && {
          paddingHorizontal:
            theme.sizes.screenPadding,
        },
        contentContainerStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View
      style={[
        styles.fill,
        padded && {
          paddingHorizontal:
            theme.sizes.screenPadding,
        },
        contentContainerStyle,
      ]}
    >
      {children}
    </View>
  );

  const wrapped = keyboardAvoiding ? (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={
        Platform.OS === "ios"
          ? "padding"
          : undefined
      }
    >
      {content}
    </KeyboardAvoidingView>
  ) : (
    content
  );

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[
        styles.fill,
        {
          backgroundColor:
            theme.colors.background.primary,
        },
        style,
      ]}
    >
      {wrapped}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
