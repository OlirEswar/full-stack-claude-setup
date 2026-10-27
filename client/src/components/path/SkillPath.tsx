import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import type { PathSkill, PathUnit } from '@/api/types';
import { CrownGlyph, LockGlyph, Text, TraceGlyph } from '@/components/ui';
import { borders, colors, palette, radii, spacing, type Tone, type ToneSwatch } from '@/theme/tokens';

export type SkillPathProps = {
  units: PathUnit[];
  onStartSkill: (skill: PathSkill) => void;
  /** Skill whose lesson is currently being created (shows a spinner, blocks double taps). */
  busySkillId?: string | null;
};

/** Units cycle through these so neighbouring sections read as distinct chapters. */
const unitTones: Tone[] = ['primary', 'secondary', 'accent'];

/** Horizontal offsets (in units of ZIG) for the winding path; repeats every 8 nodes. */
const zigzag = [0, 0.75, 1.15, 0.75, 0, -0.75, -1.15, -0.75];
const ZIG = 64;

const NODE = 72;
const RING = NODE + 18;
const RING_STROKE = 6;

/** The vertical skill path: a banner per unit and a winding column of skill nodes. */
export function SkillPath({ units, onStartSkill, busySkillId }: SkillPathProps) {
  // "Start here" goes on the first open skill the user hasn't touched yet.
  const nextUp = units.flatMap((u) => u.skills).find((s) => s.unlocked && !s.started)?.id;
  let nodeIndex = 0;

  return (
    <View style={styles.path} testID="skill-path">
      {units.map((unit, u) => {
        const tone = unitTones[u % unitTones.length];
        return (
          <View key={unit.id} style={styles.unit} testID={`unit-${unit.id}`}>
            <UnitHeader unit={unit} index={u} tone={palette[tone]} />
            <View style={styles.nodes}>
              {unit.skills.map((skill) => {
                const offset = zigzag[nodeIndex++ % zigzag.length] * ZIG;
                return (
                  <SkillNode
                    key={skill.id}
                    skill={skill}
                    tone={palette[tone]}
                    offset={offset}
                    nextUp={skill.id === nextUp}
                    busy={busySkillId === skill.id}
                    blocked={!!busySkillId}
                    onPress={() => onStartSkill(skill)}
                  />
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function UnitHeader({ unit, index, tone }: { unit: PathUnit; index: number; tone: ToneSwatch }) {
  const crowns = unit.skills.reduce((n, s) => n + s.level, 0);
  const maxCrowns = unit.skills.reduce((n, s) => n + s.maxLevel, 0);
  return (
    <View style={[styles.banner, { backgroundColor: tone.base, borderColor: tone.shade }]}>
      <View style={styles.bannerText}>
        <Text variant="label" style={[styles.bannerEyebrow, { color: tone.on }]}>
          Unit {index + 1}
        </Text>
        <Text variant="heading" style={{ color: tone.on }}>
          {unit.title}
        </Text>
        {unit.description ? (
          <Text variant="caption" style={[styles.bannerBody, { color: tone.on }]}>
            {unit.description}
          </Text>
        ) : null}
      </View>
      <View style={[styles.bannerCrowns, { backgroundColor: tone.shade }]} accessibilityLabel={`${crowns} of ${maxCrowns} crowns`}>
        <CrownGlyph size={16} />
        <Text variant="monoStrong" style={{ color: tone.on }}>
          {crowns}/{maxCrowns}
        </Text>
      </View>
    </View>
  );
}

type SkillNodeProps = {
  skill: PathSkill;
  tone: ToneSwatch;
  offset: number;
  nextUp: boolean;
  busy: boolean;
  blocked: boolean;
  onPress: () => void;
};

function SkillNode({ skill, tone, offset, nextUp, busy, blocked, onPress }: SkillNodeProps) {
  const locked = !skill.unlocked;
  const mastered = skill.level >= skill.maxLevel;
  const face: ToneSwatch = locked
    ? { base: colors.disabled.base, shade: colors.disabled.shade, tint: colors.ink[100], on: colors.disabled.text }
    : mastered
      ? palette.xp
      : tone;

  const progress = locked || mastered ? 0 : Math.min(skill.lessonsInLevel / Math.max(skill.lessonsPerLevel, 1), 1);
  const r = (RING - RING_STROKE) / 2;
  const circ = 2 * Math.PI * r;

  const status = locked
    ? 'Locked'
    : mastered
      ? 'Legendary · fully crowned'
      : `Level ${skill.level} · ${skill.lessonsInLevel}/${skill.lessonsPerLevel} lessons`;
  const a11y = [skill.title, locked ? 'locked' : `crown level ${skill.level} of ${skill.maxLevel}`, skill.due ? 'due for review' : null]
    .filter(Boolean)
    .join(', ');

  return (
    <View style={[styles.nodeCol, { transform: [{ translateX: offset }] }]}>
      {nextUp && !locked ? (
        <View style={[styles.bubble, { borderColor: tone.base }]}>
          <Text variant="label" style={{ color: tone.shade }}>
            Start here
          </Text>
          <View style={[styles.bubbleTail, { borderTopColor: tone.base }]} />
        </View>
      ) : null}
      <View style={styles.ringWrap}>
        <Svg width={RING} height={RING} style={StyleSheet.absoluteFill}>
          <Circle cx={RING / 2} cy={RING / 2} r={r} stroke={locked ? 'transparent' : colors.ink[200]} strokeWidth={RING_STROKE} fill="none" />
          {progress > 0 ? (
            <Circle
              cx={RING / 2}
              cy={RING / 2}
              r={r}
              stroke={tone.base}
              strokeWidth={RING_STROKE}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${circ * progress} ${circ}`}
              transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
            />
          ) : null}
        </Svg>
        <Pressable
          testID={`skill-node-${skill.id}`}
          onPress={onPress}
          disabled={locked || blocked}
          accessibilityRole="button"
          accessibilityLabel={a11y}
          accessibilityState={{ disabled: locked, busy }}
          style={({ pressed }) => [
            styles.node,
            {
              backgroundColor: face.base,
              borderColor: face.shade,
              borderBottomWidth: pressed && !locked ? 0 : 6,
              marginTop: pressed && !locked ? 6 : 0,
            },
          ]}
        >
          {busy ? (
            <ActivityIndicator color={face.on} />
          ) : locked ? (
            <LockGlyph size={32} />
          ) : mastered ? (
            <CrownGlyph size={32} tone={{ ...palette.xp, base: colors.surface }} />
          ) : (
            <TraceGlyph size={32} color={face.on} />
          )}
        </Pressable>
        {!locked && skill.level > 0 && !mastered ? (
          <View style={styles.crownBadge} testID={`crown-${skill.id}`}>
            <CrownGlyph size={16} />
            <Text variant="monoStrong" style={styles.crownText}>
              {skill.level}
            </Text>
          </View>
        ) : null}
        {skill.due && !locked ? (
          <View style={styles.dueBadge} testID={`due-badge-${skill.id}`}>
            <Text variant="label" style={styles.dueText}>
              Due
            </Text>
          </View>
        ) : null}
      </View>
      <Text variant="bodyStrong" align="center" style={[styles.nodeTitle, locked && { color: colors.textSubtle }]} numberOfLines={2}>
        {skill.title}
      </Text>
      <Text variant="caption" tone="subtle" align="center">
        {status}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  path: { gap: spacing.xxl },
  unit: { gap: spacing.xl },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.xl,
    borderBottomWidth: borders.edge,
  },
  bannerText: { flex: 1, gap: spacing.xxs },
  bannerEyebrow: { opacity: 0.85 },
  bannerBody: { opacity: 0.92 },
  bannerCrowns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
  },
  nodes: { alignItems: 'center', gap: spacing.xl },
  nodeCol: { alignItems: 'center', width: 168 },
  ringWrap: { width: RING, height: RING, alignItems: 'center', justifyContent: 'center' },
  node: {
    width: NODE,
    height: NODE,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crownBadge: {
    position: 'absolute',
    bottom: -2,
    right: -4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 1,
    borderRadius: radii.pill,
    backgroundColor: palette.xp.tint,
    borderWidth: borders.width,
    borderColor: palette.xp.base,
  },
  crownText: { color: palette.xp.shade, fontSize: 13, lineHeight: 18 },
  dueBadge: {
    position: 'absolute',
    top: -2,
    right: -10,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.pill,
    backgroundColor: palette.streak.base,
    borderBottomWidth: 3,
    borderColor: palette.streak.shade,
  },
  dueText: { color: palette.streak.on, fontSize: 11, lineHeight: 14 },
  nodeTitle: { marginTop: spacing.sm },
  bubble: {
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: borders.width,
  },
  bubbleTail: {
    position: 'absolute',
    bottom: -8,
    alignSelf: 'center',
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});
