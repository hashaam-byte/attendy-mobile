// src/components/SplashAnimation.tsx
//
// Attendy EDU — animated splash / launch confirmation.
//
// v2: Instead of drawing a second, hand-guessed checkmark on top of the real
// logo (v1), this version reveals the REAL checkmark that's already baked
// into your actual brand art (assets/splash-icon.png / splash-icon-dark.png —
// both verified transparent PNGs of your real mark). A rectangle the exact
// size/position of the checkmark — measured directly from your asset's pixels,
// not guessed — sits over it and slides away, "unveiling" your real checkmark
// instead of drawing a lookalike. Zero duplicate/ghost-checkmark artifact,
// because there's only ever one checkmark on screen: yours.
//
// Bonus: every animated value here drives only opacity/transform, so this
// version is 100% native-driver end to end. There is no JS-driven value left
// to ever collide with a native-driven one, which is what caused the original
// "Attempting to run JS driven animation on animated node..." crash. That bug
// class isn't just avoided here — there's nothing left for it to happen to.

import React, { useEffect, useRef } from 'react';
import { View, Image, Animated, Easing, StyleSheet, useWindowDimensions } from 'react-native';
import { useTheme } from '../context/ThemeContext';

type Props = { onFinish: () => void };

// Checkmark bounding box, measured directly from the real PNGs (fraction of
// the full 1024x1024 image canvas — the Image component renders that whole
// canvas at markSize x markSize, so these fractions map straight to pixels).
const LIGHT_BOX = { left: 0.4414, top: 0.4209, width: 0.2754, height: 0.1992 };
const DARK_BOX = { left: 0.4238, top: 0.4053, width: 0.3398, height: 0.2383 };

// Pen-tip dot's vertical path within the box, in local 0–1 units (down to the
// check's dip, then up to its tip). Horizontal position is driven by the same
// value as the reveal wipe, so the dot always sits right at the reveal edge.
const DOT_START_Y = 0.55;
const DOT_VERTEX_Y = 0.97;
const DOT_END_Y = 0.04;
const DOT_VERTEX_T = 0.32; // fraction of the draw duration spent on the down-stroke

export default function SplashAnimation({ onFinish }: Props) {
  const { theme, isDark } = useTheme();
  const { width, height } = useWindowDimensions();

  const markOpacity = useRef(new Animated.Value(0)).current;
  const markScale = useRef(new Animated.Value(0.94)).current;
  const dotOpacity = useRef(new Animated.Value(0)).current;
  const dotY = useRef(new Animated.Value(0)).current; // local px within the box
  const wipeX = useRef(new Animated.Value(0)).current; // 0 -> boxWidthPx, drives both the cover and the dot's x
  const pulseScale = useRef(new Animated.Value(0.5)).current;
  const pulseOpacity = useRef(new Animated.Value(0)).current;

  const markSize = Math.min(width, height) * 0.34;
  const box = isDark ? DARK_BOX : LIGHT_BOX;
  const boxLeft = box.left * markSize;
  const boxTop = box.top * markSize;
  const boxWidth = box.width * markSize;
  const boxHeight = box.height * markSize;

  useEffect(() => {
    dotY.setValue(DOT_START_Y * boxHeight);

    const run = Animated.sequence([
      // Step 1 (0–300ms): faint mark fades up
      Animated.timing(markOpacity, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),

      // Step 2 (300–600ms): mark settles with a soft bounce, dot appears
      Animated.parallel([
        Animated.timing(markScale, {
          toValue: 1,
          duration: 300,
          easing: Easing.bezier(0.34, 1.4, 0.64, 1),
          useNativeDriver: true,
        }),
        Animated.timing(dotOpacity, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),

      // Step 3 (600–1000ms): wipe reveals the REAL checkmark; dot rides the edge
      Animated.parallel([
        Animated.timing(wipeX, {
          toValue: boxWidth,
          duration: 380,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(dotY, {
            toValue: DOT_VERTEX_Y * boxHeight,
            duration: 380 * DOT_VERTEX_T,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(dotY, {
            toValue: DOT_END_Y * boxHeight,
            duration: 380 * (1 - DOT_VERTEX_T),
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.delay(280),
          Animated.timing(dotOpacity, { toValue: 0, duration: 100, useNativeDriver: true }),
        ]),
      ]),

      // Step 4 (1000–1300ms): confirmation pulse, Google-Pay style
      Animated.parallel([
        Animated.timing(pulseOpacity, { toValue: 0.55, duration: 1, useNativeDriver: true }),
        Animated.timing(pulseScale, {
          toValue: 1.7,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(60),
          Animated.timing(pulseOpacity, { toValue: 0, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]),
      ]),

      // Step 5 (1300–1500ms): scale to 90% + fade into the dashboard
      Animated.parallel([
        Animated.timing(markScale, { toValue: 0.9, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(markOpacity, { toValue: 0, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      ]),
    ]);

    run.start(({ finished }) => {
      if (finished) onFinish();
    });

    return () => run.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const markSource = isDark
    ? require('../../assets/splash-icon-dark.png')
    : require('../../assets/splash-icon.png');
  const checkColor = '#22C55E'; // brand green — used only for the pulse + dot accent

  return (
    <View style={[StyleSheet.absoluteFill, styles.container, { backgroundColor: theme.bg }]} pointerEvents="none">
      <Animated.View
        style={[
          styles.pulse,
          {
            width: markSize,
            height: markSize,
            borderRadius: markSize / 2,
            borderColor: checkColor,
            opacity: pulseOpacity,
            transform: [{ scale: pulseScale }],
          },
        ]}
      />

      <Animated.View
        style={{
          width: markSize,
          height: markSize,
          opacity: markOpacity,
          transform: [{ scale: markScale }],
        }}
      >
        {/* Real brand artwork — full mark, checkmark included */}
        <Image source={markSource} style={{ width: markSize, height: markSize }} resizeMode="contain" />

        {/* Reveal cover: same color as the splash background, sized/positioned
            to the real checkmark's measured bounds. Slides fully clear of the
            box to "unveil" the real checkmark — there's no second checkmark
            drawn anywhere, just yours, appearing on cue. */}
        <View
          style={{
            position: 'absolute',
            left: boxLeft,
            top: boxTop,
            width: boxWidth,
            height: boxHeight,
            overflow: 'hidden',
          }}
        >
          <Animated.View
            style={{
              width: boxWidth,
              height: boxHeight,
              backgroundColor: theme.bg,
              transform: [{ translateX: wipeX }],
            }}
          />
        </View>

        {/* Pen-tip dot, riding the reveal edge */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.dot,
            {
              backgroundColor: checkColor,
              opacity: dotOpacity,
              transform: [
                { translateX: Animated.subtract(Animated.add(boxLeft, wipeX), 6) },
                { translateY: Animated.add(boxTop, Animated.subtract(dotY, 6)) },
              ],
            },
          ]}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', zIndex: 999, elevation: 999 },
  pulse: { position: 'absolute', borderWidth: 2 },
  dot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    shadowColor: '#22C55E',
    shadowOpacity: 0.8,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
});