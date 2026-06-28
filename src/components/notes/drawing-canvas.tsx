import { useMemo, useReducer, useRef } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Point, Stroke } from '@/services/notes/types';

type DrawingCanvasProps = {
  strokes: Stroke[];
  onChange: (strokes: Stroke[]) => void;
  color: string;
  strokeWidth: number;
  height: number;
  /** Notifies the parent so it can disable scrolling while a stroke is in progress. */
  onActiveChange?: (active: boolean) => void;
};

export function pointsToPath(points: Point[]): string {
  if (points.length === 0) {
    return '';
  }
  if (points.length === 1) {
    // Render a single tap as a tiny segment so the round linecap shows a dot.
    const { x, y } = points[0];
    return `M ${x} ${y} L ${x + 0.01} ${y}`;
  }
  return points
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(' ');
}

export function DrawingCanvas({
  strokes,
  onChange,
  color,
  strokeWidth,
  height,
  onActiveChange,
}: DrawingCanvasProps) {
  const theme = useTheme();
  const currentPoints = useRef<Point[]>([]);
  const [, rerender] = useReducer((c: number) => c + 1, 0);

  // Refs keep the PanResponder (created once) reading the latest props.
  const strokesRef = useRef(strokes);
  strokesRef.current = strokes;
  const colorRef = useRef(color);
  colorRef.current = color;
  const widthRef = useRef(strokeWidth);
  widthRef.current = strokeWidth;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onActiveRef = useRef(onActiveChange);
  onActiveRef.current = onActiveChange;

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          currentPoints.current = [
            { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY },
          ];
          onActiveRef.current?.(true);
          rerender();
        },
        onPanResponderMove: (e) => {
          currentPoints.current.push({
            x: e.nativeEvent.locationX,
            y: e.nativeEvent.locationY,
          });
          rerender();
        },
        onPanResponderRelease: () => {
          if (currentPoints.current.length > 0) {
            onChangeRef.current([
              ...strokesRef.current,
              {
                color: colorRef.current,
                width: widthRef.current,
                points: currentPoints.current,
              },
            ]);
          }
          currentPoints.current = [];
          onActiveRef.current?.(false);
          rerender();
        },
        onPanResponderTerminate: () => {
          currentPoints.current = [];
          onActiveRef.current?.(false);
          rerender();
        },
      }),
    [],
  );

  return (
    <View
      {...responder.panHandlers}
      style={[
        styles.canvas,
        { height, backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected },
      ]}>
      <Svg width="100%" height={height}>
        {strokes.map((stroke, index) => (
          <Path
            key={index}
            d={pointsToPath(stroke.points)}
            stroke={stroke.color}
            strokeWidth={stroke.width}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {currentPoints.current.length > 0 && (
          <Path
            d={pointsToPath(currentPoints.current)}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    width: '100%',
    borderRadius: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
});
