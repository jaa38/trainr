import type { Href } from 'expo-router';

import {
  TabList,
  type TabListProps,
  Tabs,
  TabSlot,
  TabTrigger,
  type TabTriggerSlotProps,
} from 'expo-router/ui';
import { Pressable, StyleSheet, useColorScheme, View } from 'react-native';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';

type UserRole = 'gym-goer' | 'personal-trainer';

type AppTabsProps = {
  role: UserRole;
};

type TabConfig = {
  name: string;
  label: string;
  href: Href;
};

const gymGoerTabs: TabConfig[] = [
  {
    name: 'home',
    label: 'Home',
    href: '/(tabs)/gym-goer',
  },
  {
    name: 'discover',
    label: 'Discover',
    href: '/(tabs)/gym-goer/discover',
  },
  {
    name: 'workouts',
    label: 'Workouts',
    href: '/(tabs)/gym-goer/workouts',
  },
  {
    name: 'sessions',
    label: 'Sessions',
    href: '/(tabs)/gym-goer/sessions',
  },
  {
    name: 'profile',
    label: 'Profile',
    href: '/(tabs)/gym-goer/profile',
  },
];

const personalTrainerTabs: TabConfig[] = [
  {
    name: 'home',
    label: 'Home',
    href: '/(tabs)/personal-trainer',
  },
  {
    name: 'clients',
    label: 'Clients',
    href: '/(tabs)/personal-trainer/clients',
  },
  {
    name: 'schedule',
    label: 'Schedule',
    href: '/(tabs)/personal-trainer/schedule',
  },
  {
    name: 'earnings',
    label: 'Earnings',
    href: '/(tabs)/personal-trainer/earnings',
  },
  {
    name: 'more',
    label: 'More',
    href: '/(tabs)/personal-trainer/more',
  },
];

export default function AppTabs({ role }: AppTabsProps) {
  const tabs =
    role === 'personal-trainer' ? personalTrainerTabs : gymGoerTabs;

  return (
    <Tabs>
      <TabSlot style={styles.tabSlot} />

      <TabList asChild>
        <CustomTabList>
          {tabs.map((tab) => (
            <TabTrigger
              key={tab.name}
              name={tab.name}
              href={tab.href}
              asChild
            >
              <TabButton>{tab.label}</TabButton>
            </TabTrigger>
          ))}
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({
  children,
  isFocused,
  ...props
}: TabTriggerSlotProps) {
  return (
    <Pressable
      {...props}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      style={({ pressed }) => [
        styles.tabButton,
        pressed && styles.pressed,
      ]}
    >
      <ThemedView
        type={isFocused ? 'backgroundSelected' : 'backgroundElement'}
        style={styles.tabButtonView}
      >
        <ThemedText
          type="small"
          themeColor={isFocused ? 'text' : 'textSecondary'}
        >
          {children}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  return (
    <View {...props} style={styles.tabListContainer}>
      <ThemedView
        type="backgroundElement"
        style={[
          styles.innerContainer,
          { borderColor: colors.backgroundElement },
        ]}
      >
        <ThemedText type="smallBold" style={styles.brandText}>
          TRAINR
        </ThemedText>

        {props.children}
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabSlot: {
    flex: 1,
    minHeight: 0,
  },
  tabListContainer: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
  },
  innerContainer: {
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.five,
    borderRadius: Spacing.five,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  brandText: {
    marginRight: 'auto',
  },
  tabButton: {
    flexShrink: 0,
  },
  tabButtonView: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  pressed: {
    opacity: 0.7,
  },
});
