import { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { useTrainrTheme } from '@/theme';

type ClientStatus = 'Active' | 'Pending';

type Client = {
  id: string;
  name: string;
  goal: string;
  status: ClientStatus;
  sessions: number;
  initials: string;
};

type Filter = 'All' | 'Active' | 'Pending';

const demoClients: Client[] = [
  {
    id: '1',
    name: 'Alex Morgan',
    goal: 'Strength & muscle',
    status: 'Active',
    sessions: 12,
    initials: 'AM',
  },
  {
    id: '2',
    name: 'Sarah Johnson',
    goal: 'Weight management',
    status: 'Active',
    sessions: 8,
    initials: 'SJ',
  },
  {
    id: '3',
    name: 'Daniel Williams',
    goal: 'Improve fitness',
    status: 'Pending',
    sessions: 0,
    initials: 'DW',
  },
  {
    id: '4',
    name: 'Olivia Brown',
    goal: 'Build strength',
    status: 'Active',
    sessions: 16,
    initials: 'OB',
  },
];

const filters: Filter[] = ['All', 'Active', 'Pending'];

export default function ClientsScreen() {
  const { colors, spacing } = useTrainrTheme();

  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<Filter>('All');

  const filteredClients = useMemo(() => {
    const query = search.trim().toLowerCase();

    return demoClients.filter((client) => {
      const matchesSearch =
        client.name.toLowerCase().includes(query) ||
        client.goal.toLowerCase().includes(query);

      const matchesFilter = activeFilter === 'All' || client.status === activeFilter;

      return matchesSearch && matchesFilter;
    });
  }, [search, activeFilter]);

  const activeCount = demoClients.filter((client) => client.status === 'Active').length;

  const pendingCount = demoClients.filter((client) => client.status === 'Pending').length;

  return (
    <SafeAreaView
      edges={['top']}
      style={{
        flex: 1,
        backgroundColor: colors.background.primary,
      }}
    >
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: spacing.xxxl,
          gap: spacing.lg,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <View style={{ flex: 1, gap: spacing.xs }}>
            <AppText
              variant="caption"
              color={colors.brand.red}
              style={{ letterSpacing: 1.5 }}
            >
              TRAINER WORKSPACE
            </AppText>

            <AppText variant="displayLarge" color={colors.text.primary}>
              CLIENTS.
            </AppText>

            <AppText variant="body" color={colors.text.secondary}>
              Your people. Their progress.
            </AppText>
          </View>

          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.brand.red,
            }}
          >
            <AppText variant="h3" color="#FFFFFF">
              {demoClients.length}
            </AppText>
          </View>
        </View>

        {/* Overview */}
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View
            style={{
              flex: 1,
              padding: spacing.md,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.border.default,
              backgroundColor: colors.background.secondary,
              gap: spacing.xs,
            }}
          >
            <AppText variant="caption" color={colors.text.secondary}>
              ACTIVE CLIENTS
            </AppText>
            <AppText variant="displayLarge" color={colors.text.primary}>
              {activeCount}
            </AppText>
          </View>

          <View
            style={{
              flex: 1,
              padding: spacing.md,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.border.default,
              backgroundColor: colors.background.secondary,
              gap: spacing.xs,
            }}
          >
            <AppText variant="caption" color={colors.text.secondary}>
              PENDING
            </AppText>
            <AppText variant="displayLarge" color={colors.brand.red}>
              {pendingCount}
            </AppText>
          </View>
        </View>

        {/* Search */}
        <View
          style={{
            minHeight: 52,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: spacing.md,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border.default,
            backgroundColor: colors.background.secondary,
          }}
        >
          <AppText variant="body" color={colors.text.tertiary}>
            Search
          </AppText>

          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Name or fitness goal"
            placeholderTextColor={colors.text.tertiary}
            accessibilityLabel="Search clients by name or fitness goal"
            returnKeyType="search"
            autoCapitalize="none"
            style={{
              flex: 1,
              marginLeft: spacing.md,
              paddingVertical: spacing.sm,
              color: colors.text.primary,
              fontSize: 16,
            }}
          />

          {search.length > 0 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear client search"
              onPress={() => setSearch('')}
              hitSlop={8}
            >
              <AppText variant="button" color={colors.brand.red}>
                Clear
              </AppText>
            </Pressable>
          )}
        </View>

        {/* Filters */}
        <View style={{ gap: spacing.md }}>
          <AppText variant="h3" color={colors.text.primary}>
            YOUR CLIENTS
          </AppText>

          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {filters.map((filter) => {
              const selected = activeFilter === filter;

              return (
                <Pressable
                  key={filter}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setActiveFilter(filter)}
                  style={{
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: selected ? colors.brand.red : colors.border.default,
                    backgroundColor: selected
                      ? colors.brand.red
                      : colors.background.primary,
                  }}
                >
                  <AppText
                    variant="button"
                    color={selected ? '#FFFFFF' : colors.text.secondary}
                  >
                    {filter}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Client list */}
        {filteredClients.length > 0 ? (
          <View style={{ gap: spacing.md }}>
            {filteredClients.map((client) => {
              const isActive = client.status === 'Active';

              return (
                <Pressable
                  key={client.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${client.name}, ${client.status} client`}
                  onPress={() => {
                    // Client detail navigation will be added next.
                  }}
                  style={({ pressed }) => ({
                    padding: spacing.md,
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: colors.border.default,
                    backgroundColor: colors.background.secondary,
                    gap: spacing.md,
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.md,
                    }}
                  >
                    <View
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 16,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: colors.brand.red,
                      }}
                    >
                      <AppText variant="h3" color="#FFFFFF">
                        {client.initials}
                      </AppText>
                    </View>

                    <View style={{ flex: 1, gap: spacing.xs }}>
                      <AppText variant="h3" color={colors.text.primary}>
                        {client.name}
                      </AppText>

                      <AppText variant="bodySmall" color={colors.text.secondary}>
                        {client.goal}
                      </AppText>
                    </View>

                    <View
                      style={{
                        paddingHorizontal: spacing.sm,
                        paddingVertical: spacing.xs,
                        borderRadius: 8,
                        backgroundColor: isActive
                          ? colors.brand.redLight
                          : colors.background.primary,
                        borderWidth: 1,
                        borderColor: isActive ? colors.brand.red : colors.border.default,
                      }}
                    >
                      <AppText
                        variant="caption"
                        color={isActive ? colors.brand.red : colors.text.secondary}
                      >
                        {client.status}
                      </AppText>
                    </View>
                  </View>

                  <View
                    style={{
                      height: 1,
                      backgroundColor: colors.border.default,
                    }}
                  />

                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <View style={{ gap: spacing.xs }}>
                      <AppText variant="caption" color={colors.text.tertiary}>
                        COMPLETED SESSIONS
                      </AppText>

                      <AppText variant="h3" color={colors.text.primary}>
                        {client.sessions}
                      </AppText>
                    </View>

                    <AppText variant="button" color={colors.brand.red}>
                      View client →
                    </AppText>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View
            style={{
              alignItems: 'center',
              padding: spacing.xl,
              gap: spacing.md,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: colors.border.default,
              backgroundColor: colors.background.secondary,
            }}
          >
            <AppText variant="h3" color={colors.text.primary}>
              NO CLIENTS FOUND.
            </AppText>

            <AppText
              variant="body"
              color={colors.text.secondary}
              style={{ textAlign: 'center' }}
            >
              Try another search term or select a different status filter.
            </AppText>

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setSearch('');
                setActiveFilter('All');
              }}
              style={{
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
                borderRadius: 12,
                backgroundColor: colors.brand.red,
              }}
            >
              <AppText variant="button" color="#FFFFFF">
                Clear filters
              </AppText>
            </Pressable>
          </View>
        )}

        <AppText
          variant="caption"
          color={colors.text.tertiary}
          style={{ textAlign: 'center' }}
        >
          SAMPLE CLIENT DATA — NOT CONNECTED TO SUPABASE
        </AppText>
      </ScrollView>
    </SafeAreaView>
  );
}
