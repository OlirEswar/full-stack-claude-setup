import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/AuthContext';
import { Button, EmptyState, ProfileGlyph, Screen } from '@/components/ui';
import { spacing } from '@/theme/tokens';

// Placeholder; task 28 adds stats, per-skill progress and settings.
export default function ProfileScreen() {
  const { user, logout } = useAuth();
  return (
    <Screen testID="profile-screen" scroll={false} edges={['top', 'left', 'right']}>
      <EmptyState
        illustration={<ProfileGlyph size={48} />}
        title={user ? user.username : 'Your profile'}
        message="Stats, skill strength and settings are coming here soon."
      />
      <View style={styles.actions}>
        <Button label="Log out" variant="secondary" onPress={() => void logout()} testID="logout-button" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { paddingBottom: spacing.xl },
});
