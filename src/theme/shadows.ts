import { Platform } from "react-native";

export const shadows = {
  none: {},

  subtle:
    Platform.select({
      ios: {
        shadowColor: "#000000",
        shadowOffset: {
          width: 0,
          height: 1,
        },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },

      android: {
        elevation: 1,
      },

      default: {},
    }) ?? {},

  medium:
    Platform.select({
      ios: {
        shadowColor: "#000000",
        shadowOffset: {
          width: 0,
          height: 4,
        },
        shadowOpacity: 0.12,
        shadowRadius: 10,
      },

      android: {
        elevation: 4,
      },

      default: {},
    }) ?? {},
} as const;
