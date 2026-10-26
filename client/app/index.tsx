import { StyleSheet, Text, View } from 'react-native';

// Placeholder home screen; replaced by the skill path in a later task.
export default function Index() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Loopy</Text>
      <Text style={styles.subtitle}>Control theory, one quick loop at a time.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 16,
  },
});
