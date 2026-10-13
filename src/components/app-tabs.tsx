import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';
import { colors as trainrColors } from '@/theme/colors';

type UserRole = 'gym-goer' | 'personal-trainer';

type AppTabsProps = {
  role: UserRole;
};

const gymGoerTabs = [
  { name: 'index', label: 'Home', sf: 'house.fill', md: 'home' },
  { name: 'discover', label: 'Discover', sf: 'magnifyingglass', md: 'search' },
  { name: 'workouts', label: 'Workouts', sf: 'dumbbell.fill', md: 'fitness_center' },
  { name: 'sessions', label: 'Sessions', sf: 'calendar', md: 'calendar_month' },
  { name: 'profile', label: 'Profile', sf: 'person.fill', md: 'person' },
] as const;

const personalTrainerTabs = [
  { name: 'index', label: 'Home', sf: 'house.fill', md: 'home' },
  { name: 'clients', label: 'Clients', sf: 'person.2.fill', md: 'groups' },
  { name: 'schedule', label: 'Schedule', sf: 'calendar', md: 'calendar_month' },
  {
    name: 'earnings',
    label: 'Earnings',
    sf: 'dollarsign.circle.fill',
    md: 'account_balance_wallet',
  },
  { name: 'profile', label: 'Profile', sf: 'person.fill', md: 'person' },
] as const;

export default function AppTabs({ role }: AppTabsProps) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  const nativeColors = Colors[isDark ? 'dark' : 'light'];
  const brand = trainrColors.brand[isDark ? 'dark' : 'light'];

  const tabs = role === 'gym-goer' ? gymGoerTabs : personalTrainerTabs;

  return (
    <NativeTabs
      backgroundColor={nativeColors.background}
      indicatorColor={brand.redLight}
      tintColor={brand.red}
      labelStyle={{
        selected: {
          color: brand.red,
        },
      }}
    >
      {tabs.map((tab) => (
        <NativeTabs.Trigger key={tab.name} name={tab.name}>
          <NativeTabs.Trigger.Label>{tab.label}</NativeTabs.Trigger.Label>

          <NativeTabs.Trigger.Icon sf={tab.sf} md={tab.md} />
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
