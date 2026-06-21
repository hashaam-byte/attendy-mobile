import React from 'react';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

export type LogoMarkVariant = 'gradient' | 'light' | 'dark' | 'mono';

interface LogoMarkProps {
  size?: number;
  variant?: LogoMarkVariant;
  /** Render only the "A" stroke, omitting the checkmark (used by the splash draw-on sequence) */
  hideCheck?: boolean;
  /** 0–1 opacity applied to the "A" stroke (used for the faint-outline splash step) */
  aOpacity?: number;
  monoColor?: string;
}

/**
 * Attendy brand mark — the "A" with an integrated checkmark.
 * Paths are traced from the production icon artwork (assets/icon.png) so this
 * vector matches the shipped app icon exactly.
 *
 * variant:
 *  - gradient: green gradient A + green gradient check (default, light backgrounds)
 *  - light:    solid white A + green check (for dark backgrounds)
 *  - dark:     solid #101010 A + green check (rarely needed, light backgrounds w/ dark text)
 *  - mono:     single flat color for both A and check (monoColor), no gradients
 */
export default function LogoMark({
  size = 120,
  variant = 'gradient',
  hideCheck = false,
  aOpacity = 1,
  monoColor = '#16A34A',
}: LogoMarkProps) {
  const aFill =
    variant === 'light' ? '#FFFFFF'
    : variant === 'dark' ? '#101010'
    : variant === 'mono' ? monoColor
    : 'url(#attendyAGradient)';

  const checkFill =
    variant === 'mono' ? monoColor : 'url(#attendyCheckGradient)';

  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024" fill="none">
      <Defs>
        <LinearGradient id="attendyAGradient" x1="512" y1="180" x2="512" y2="780" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#4ADE80" />
          <Stop offset="1" stopColor="#16A34A" />
        </LinearGradient>
        <LinearGradient id="attendyCheckGradient" x1="430" y1="520" x2="800" y2="620" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#22C55E" />
          <Stop offset="1" stopColor="#15803D" />
        </LinearGradient>
      </Defs>

      {/* "A" body: apex + both legs, traced to match the production icon */}
      <Path
        opacity={aOpacity}
        fill={aFill}
        d="M512 191
           C 524 191 535 198 540 209
           L 700 596
           C 706 611 699 628 684 634
           C 669 640 652 633 646 618
           L 583 466
           L 480 466
           L 348 765
           C 342 779 326 786 312 781
           C 297 776 290 760 295 745
           L 484 209
           C 489 198 500 191 512 191 Z
           M 512 384 L 562 466 L 462 466 Z"
        fillRule="evenodd"
      />

      {/* Right leg stub beneath the checkmark overlap (only visible where check doesn't cover it) */}
      {!hideCheck && (
        <Path
          opacity={aOpacity}
          fill={aFill}
          d="M612 600 L700 600 L774 771 L676 771 Z"
        />
      )}

      {/* Checkmark — draws on last in the splash sequence */}
      {!hideCheck && (
        <Path
          fill={checkFill}
          d="M430 612
             C 420 602 404 602 394 612
             C 384 622 384 638 394 648
             L 486 738
             C 496 748 512 748 522 738
             L 765 510
             C 775 500 775 484 765 474
             C 755 464 739 464 729 474
             L 504 684
             Z"
        />
      )}
    </Svg>
  );
}
