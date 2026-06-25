// src/components/SplashAnimation.tsx — Attendy EDU v3
//
// THREE-PART SEQUENTIAL BUILD ANIMATION
// ─────────────────────────────────────
// Instead of fading-in the whole mark at once and then wipe-revealing
// the checkmark, this version BUILDS the logo from its constituent parts,
// making it feel assembled in front of the user — like a premium brand
// reveal (think Spotify, Linear, Vercel).
//
// How it works
// ─────────────
// The real brand artwork (splash-icon.png / splash-icon-dark.png) is rendered
// three times, each copy clipped to a different rectangular zone via an
// overflow:hidden container. Each zone animates in independently:
//
//   ZONE 1 — Left leg of the A
//     Clip: left 0 → 49% of mark, full height
//     Enters: rises up from below  (translateY: +100% → 0)
//     Timing: 0 – 420ms
//
//   ZONE 2 — Right leg + peak of the A
//     Clip: right 49% → 100% of mark, upper 57%
//     Enters: rises up from below, 80ms behind Zone 1 (staggered)
//     Timing: 80 – 480ms
//
//   ZONE 3 — Checkmark / crossbar
//     Clip: the exact crossbar band measured from the real PNG pixels
//     Enters: sweeps in from right (translateX: +60% → 0)
//     Timing: 420 – 780ms
//
// After all three arrive:
//   • Google-Pay-style confirmation pulse  (780–1080ms)
//   • Logo scales to 90% + fades out      (1080–1260ms)
//
// The split x-coordinate (0.491) and zone heights were measured
// pixel-by-pixel from the real asset — not guessed. See git history
// for the Python scan that produced these constants.
//
// BUG FIX NOTE
// ─────────────
// All Animated.Values here drive only transform/opacity — 100% native
// driver. There is no JS-driven value anywhere in this file, which is
// what caused the original "Attempting to run JS driven animation on
// animated node that has been moved to native" crash. That bug class
// is structurally impossible when everything is useNativeDriver: true.

import React, { useEffect, useRef } from 'react';
import {
  View, Image, Animated, Easing, StyleSheet, useWindowDimensions,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';

type Props = { onFinish: () => void };

// ── Zone geometry (measured from real pixel data, canvas fractions) ───────────
const SPLIT_X   = 0.491;   // horizontal seam between left and right leg of the A
const PEAK_Y    = 0.264;   // top of the A (first green pixel row)
const CHECK_TOP = 0.498;   // top of the crossbar / checkmark area
const CHECK_BOT = 0.660;   // bottom of the crossbar / checkmark area

// Light and dark versions are geometrically identical — only color differs
const LIGHT_SRC = require('../../assets/splash-icon.png');
const DARK_SRC  = require('../../assets/splash-icon-dark.png');

// ─────────────────────────────────────────────────────────────────────────────
export default function SplashAnimation({ onFinish }: Props) {
  const { theme, isDark } = useTheme();
  const { width, height } = useWindowDimensions();

  const markSize = Math.min(width, height) * 0.36;
  const source   = isDark ? DARK_SRC : LIGHT_SRC;
  const green    = '#22C55E';

  // ── Animated values — all native-driver safe ──────────────────────────────
  const leg1Y     = useRef(new Animated.Value(markSize)).current;  // Zone 1 enter
  const leg2Y     = useRef(new Animated.Value(markSize)).current;  // Zone 2 enter
  const checkX    = useRef(new Animated.Value(markSize * 0.6)).current; // Zone 3 enter
  const checkOp   = useRef(new Animated.Value(0)).current;         // Zone 3 fade-in guard
  const pulseS    = useRef(new Animated.Value(0.6)).current;
  const pulseOp   = useRef(new Animated.Value(0)).current;
  const masterS   = useRef(new Animated.Value(1)).current;         // exit scale
  const masterOp  = useRef(new Animated.Value(1)).current;         // exit fade

  // ── Zone 3 clip dimensions ────────────────────────────────────────────────
  const checkClipLeft   = markSize * 0.28;
  const checkClipTop    = markSize * CHECK_TOP;
  const checkClipWidth  = markSize * 0.46;
  const checkClipHeight = markSize * (CHECK_BOT - CHECK_TOP);

  useEffect(() => {
    const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);
    const SPRING   = Easing.bezier(0.34, 1.4, 0.64, 1); // gentle overshoot

    const seq = Animated.sequence([

      // ── Phase 1: Left leg rises (0–420ms) ───────────────────────────────
      Animated.parallel([
        Animated.timing(leg1Y, {
          toValue: 0, duration: 420,
          easing: EASE_OUT, useNativeDriver: true,
        }),
        // Right leg starts 80ms later, within the same parallel block
        Animated.sequence([
          Animated.delay(80),
          Animated.timing(leg2Y, {
            toValue: 0, duration: 380,
            easing: EASE_OUT, useNativeDriver: true,
          }),
        ]),
      ]),

      // ── Phase 2: Checkmark sweeps in from right (420–780ms) ─────────────
      Animated.parallel([
        Animated.timing(checkOp, {
          toValue: 1, duration: 1,
          useNativeDriver: true,
        }),
        Animated.timing(checkX, {
          toValue: 0, duration: 360,
          easing: SPRING, useNativeDriver: true,
        }),
      ]),

      // ── Phase 3: Confirmation pulse (780–1080ms) ─────────────────────────
      Animated.parallel([
        Animated.timing(pulseOp,  { toValue: 0.5, duration: 1,   useNativeDriver: true }),
        Animated.timing(pulseS,   { toValue: 1.8, duration: 300, easing: EASE_OUT, useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(40),
          Animated.timing(pulseOp, { toValue: 0, duration: 260, easing: EASE_OUT, useNativeDriver: true }),
        ]),
      ]),

      // ── Phase 4: Exit — scale to 90% + fade (1080–1260ms) ────────────────
      Animated.parallel([
        Animated.timing(masterS,  { toValue: 0.9, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(masterOp, { toValue: 0,   duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      ]),
    ]);

    seq.start(({ finished }) => { if (finished) onFinish(); });
    return () => seq.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View
      style={[StyleSheet.absoluteFill, styles.root, { backgroundColor: theme.bg }]}
      pointerEvents="none"
    >
      {/* Confirmation pulse ring */}
      <Animated.View
        style={[
          styles.pulse,
          {
            width: markSize, height: markSize,
            borderRadius: markSize / 2,
            borderColor: green,
            opacity: pulseOp,
            transform: [{ scale: pulseS }],
          },
        ]}
      />

      {/* Master wrapper — controls exit scale + opacity */}
      <Animated.View
        style={{
          width: markSize, height: markSize,
          opacity: masterOp,
          transform: [{ scale: masterS }],
        }}
      >

        {/* ── ZONE 1: Left leg of the A ─────────────────────────────────
            Clip: x 0 → 49.1%, y 0 → 100%
            The image inside is full-size, rising up (translateY).          */}
        <View
          style={{
            position: 'absolute',
            left: 0, top: 0,
            width: markSize * SPLIT_X,
            height: markSize,
            overflow: 'hidden',
          }}
        >
          <Animated.Image
            source={source}
            style={{
              position: 'absolute',
              left: 0, top: 0,
              width: markSize, height: markSize,
              transform: [{ translateY: leg1Y }],
            }}
            resizeMode="contain"
          />
        </View>

        {/* ── ZONE 2: Right leg + peak ──────────────────────────────────
            Clip: x 49.1% → 100%, y 0 → 57% (the upper body of the A).
            The image is offset left by SPLIT_X so the right portion aligns. */}
        <View
          style={{
            position: 'absolute',
            left: markSize * SPLIT_X, top: 0,
            width: markSize * (1 - SPLIT_X),
            height: markSize * (CHECK_TOP + 0.06),  // just above where check starts
            overflow: 'hidden',
          }}
        >
          <Animated.Image
            source={source}
            style={{
              position: 'absolute',
              left: -(markSize * SPLIT_X), top: 0,
              width: markSize, height: markSize,
              transform: [{ translateY: leg2Y }],
            }}
            resizeMode="contain"
          />
        </View>

        {/* ── ZONE 3: Checkmark / crossbar ──────────────────────────────
            Clip: precisely the crossbar band measured from real pixels.
            Sweeps in from the right (translateX).                          */}
        <Animated.View
          style={{
            position: 'absolute',
            left: checkClipLeft,
            top: checkClipTop,
            width: checkClipWidth,
            height: checkClipHeight,
            overflow: 'hidden',
            opacity: checkOp,
          }}
        >
          <Animated.Image
            source={source}
            style={{
              position: 'absolute',
              left: -checkClipLeft,
              top: -checkClipTop,
              width: markSize, height: markSize,
              transform: [{ translateX: checkX }],
            }}
            resizeMode="contain"
          />
        </Animated.View>

      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:  { alignItems: 'center', justifyContent: 'center', zIndex: 999, elevation: 999 },
  pulse: { position: 'absolute', borderWidth: 2 },
});