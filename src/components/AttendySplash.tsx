import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, Easing, StyleSheet, useColorScheme } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface AttendySplashProps {
  /** Called once the full sequence (incl. settle/fade) has finished. */
  onFinish?: () => void;
  /** Force a theme instead of reading the system scheme. */
  forceDark?: boolean;
}

// Checkmark path + its approximate on-screen length, used to drive the "drawing" stroke animation.
const CHECK_PATH =
  'M430 612 C420 602 404 602 394 612 C384 622 384 638 394 648 L486 738 C496 748 512 748 522 738 L765 510 C775 500 775 484 765 474 C755 464 739 464 729 474 L504 684 Z';
const CHECK_PATH_LENGTH = 560; // approximate, used for stroke-dash draw-on effect

const A_PATH =
  'M512 191 C524 191 535 198 540 209 L700 596 C706 611 699 628 684 634 C669 640 652 633 646 618 L583 466 L480 466 L348 765 C342 779 326 786 312 781 C297 776 290 760 295 745 L484 209 C489 198 500 191 512 191 Z M512 384 L562 466 L462 466 Z';
const A_LEG_PATH = 'M612 600 L700 600 L774 771 L676 771 Z';

export default function AttendySplash({ onFinish, forceDark }: AttendySplashProps) {
  const systemScheme = useColorScheme();
  const isDark = forceDark ?? systemScheme === 'dark';
  const [mounted, setMounted] = useState(true);

  // Animated values for each phase
  const aOpacity = useRef(new Animated.Value(0.2)).current;
  const dotOpacity = useRef(new Animated.Value(0)).current;
  const dotScale = useRef(new Animated.Value(0.4)).current;
  const dotTranslateX = useRef(new Animated.Value(0)).current;
  const dotTranslateY = useRef(new Animated.Value(0)).current;
  const checkDashOffset = useRef(new Animated.Value(CHECK_PATH_LENGTH)).current;
  const checkOpacity = useRef(new Animated.Value(0)).current;
  const checkFillOpacity = useRef(new Animated.Value(0)).current;
  const pulseScale = useRef(new Animated.Value(0.3)).current;
  const pulseOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(1)).current;
  const sceneOpacity = useRef(new Animated.Value(1)).current;

  const bg = isDark ? '#101010' : '#FFFFFF';
  const aColor = isDark ? '#FFFFFF' : undefined; // gradient used if undefined (light mode)

  useEffect(() => {
    // Dot starts near the apex-right area and travels to the checkmark's start point,
    // matching "lower-right of the logo" → sweeps through the check shape.
    dotTranslateX.setValue(70);
    dotTranslateY.setValue(-40);

    const sequence = Animated.sequence([
      // Step 1 (0–300ms): faint outline fade-in
      Animated.timing(aOpacity, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      // Step 2 (300–600ms): dot appears, soft glow-in
      Animated.parallel([
        Animated.timing(dotOpacity, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(dotScale, {
          toValue: 1,
          friction: 5,
          tension: 120,
          useNativeDriver: true,
        }),
      ]),
      // Step 3 (600–1000ms): dot moves while the checkmark draws on (stroke first, fill follows)
      Animated.parallel([
        Animated.timing(dotTranslateX, {
          toValue: 0,
          duration: 400,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          useNativeDriver: true,
        }),
        Animated.timing(dotTranslateY, {
          toValue: 0,
          duration: 400,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          useNativeDriver: true,
        }),
        Animated.timing(checkOpacity, {
          toValue: 1,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.timing(checkDashOffset, {
          toValue: 0,
          duration: 380,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false, // strokeDashoffset isn't supported by the native driver
        }),
        Animated.timing(checkFillOpacity, {
          toValue: 1,
          duration: 180,
          delay: 320, // fill only appears once the stroke has nearly finished drawing
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(dotOpacity, {
          toValue: 0,
          duration: 250,
          delay: 280,
          useNativeDriver: true,
        }),
      ]),
      // Step 4 (1000–1300ms): soft circular pulse, expand + fade
      Animated.parallel([
        Animated.timing(pulseOpacity, {
          toValue: 1,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.timing(pulseScale, {
          toValue: 1.6,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(pulseOpacity, {
          toValue: 0,
          duration: 300,
          delay: 80,
          useNativeDriver: true,
        }),
      ]),
      // Step 5 (1300–1500ms): settle to ~90% scale, then fade whole scene into dashboard
      Animated.parallel([
        Animated.timing(logoScale, {
          toValue: 0.9,
          duration: 200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]);

    sequence.start(() => {
      Animated.timing(sceneOpacity, {
        toValue: 0,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        setMounted(false);
        onFinish?.();
      });
    });
  }, []);

  if (!mounted) return null;

  return (
    <Animated.View style={[styles.container, { backgroundColor: bg, opacity: sceneOpacity }]}>
      <Animated.View style={{ transform: [{ scale: logoScale }] }}>
        <View style={styles.markWrap}>
          {/* Pulse ring */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.pulseRing,
              {
                borderColor: '#22C55E',
                opacity: pulseOpacity,
                transform: [{ scale: pulseScale }],
              },
            ]}
          />

          <Svg width={160} height={160} viewBox="0 0 1024 1024" fill="none">
            <Defs>
              <LinearGradient id="splashAGradient" x1="512" y1="180" x2="512" y2="780" gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor="#4ADE80" />
                <Stop offset="1" stopColor="#16A34A" />
              </LinearGradient>
              <LinearGradient id="splashCheckGradient" x1="430" y1="520" x2="800" y2="620" gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor="#22C55E" />
                <Stop offset="1" stopColor="#15803D" />
              </LinearGradient>
            </Defs>

            {/* The "A" outline/body — fades in at 20% opacity first, then to full */}
            <AnimatedPath
              d={A_PATH}
              fillRule="evenodd"
              fill={aColor ?? 'url(#splashAGradient)'}
              opacity={aOpacity}
            />
            <AnimatedPath d={A_LEG_PATH} fill={aColor ?? 'url(#splashAGradient)'} opacity={aOpacity} />

            {/* Checkmark — strokes on using dash offset animation */}
            <AnimatedPath
              d={CHECK_PATH}
              fill="none"
              stroke="url(#splashCheckGradient)"
              strokeWidth={6}
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={CHECK_PATH_LENGTH}
              strokeDashoffset={checkDashOffset}
              opacity={checkOpacity}
            />
            {/* Filled checkmark underneath, faded in only after the stroke finishes drawing,
                so the sequence reads as "written then filled" rather than appearing all at once. */}
            <AnimatedPath d={CHECK_PATH} fill="url(#splashCheckGradient)" opacity={checkFillOpacity} />
          </Svg>

          {/* Traveling dot */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.dot,
              {
                opacity: dotOpacity,
                transform: [
                  { translateX: dotTranslateX },
                  { translateY: dotTranslateY },
                  { scale: dotScale },
                ],
              },
            ]}
          />
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  markWrap: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
  },
  dot: {
    position: 'absolute',
    right: 22,
    bottom: 38,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#22C55E',
    shadowColor: '#22C55E',
    shadowOpacity: 0.8,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
});
