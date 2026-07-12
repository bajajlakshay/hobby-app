import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { DrawingCanvasInfo, Point, Stroke } from '@/services/notes/types';

type DrawingCanvasProps = {
  strokes: Stroke[];
  onChange: (strokes: Stroke[]) => void;
  color: string;
  strokeWidth: number;
  height: number;
  /**
   * The coordinate space the drawing was authored in. When absent (new note or
   * a legacy drawing), the canvas adopts its own layout size and reports it via
   * {@link onAdoptCanvas} so the editor can persist it with the note.
   */
  canvas?: DrawingCanvasInfo | null;
  onAdoptCanvas?: (canvas: { width: number; height: number }) => void;
  /** Background the strokes were drawn on; falls back to the theme's surface. */
  background?: string;
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
  canvas,
  onAdoptCanvas,
  background,
  onActiveChange,
}: DrawingCanvasProps) {
  const theme = useTheme();
  const [layoutWidth, setLayoutWidth] = useState(0);
  // The stroke being drawn right now. Accumulated in a ref (event handlers) and
  // mirrored into state for rendering.
  const currentPoints = useRef<Point[]>([]);
  const [livePoints, setLivePoints] = useState<Point[]>([]);

  // Strokes are stored in the authored coordinate space and rendered through a
  // viewBox, so they scale uniformly on any screen width. Touch input is mapped
  // from layout pixels into that space with the same factor.
  const docWidth = canvas?.width ?? layoutWidth;
  const scale = layoutWidth > 0 && docWidth > 0 ? docWidth / layoutWidth : 1;
  const viewBoxHeight = height * scale;

  const onLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    setLayoutWidth(width);
    if (!canvas && width > 0 && height > 0) {
      onAdoptCanvas?.({ width, height });
    }
  };

  // Refs keep the PanResponder (created once) reading the latest props.
  const strokesRef = useRef(strokes);
  const colorRef = useRef(color);
  const widthRef = useRef(strokeWidth);
  const scaleRef = useRef(scale);
  const onChangeRef = useRef(onChange);
  const onActiveRef = useRef(onActiveChange);
  useEffect(() => {
    strokesRef.current = strokes;
    colorRef.current = color;
    widthRef.current = strokeWidth;
    scaleRef.current = scale;
    onChangeRef.current = onChange;
    onActiveRef.current = onActiveChange;
  });

  const responder = useMemo(
    () =>
      // eslint-disable-next-line react-hooks/refs -- handlers read the refs only inside touch events, never during render
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          const s = scaleRef.current;
          currentPoints.current = [
            { x: e.nativeEvent.locationX * s, y: e.nativeEvent.locationY * s },
          ];
          setLivePoints(currentPoints.current.slice());
          onActiveRef.current?.(true);
        },
        onPanResponderMove: (e) => {
          const s = scaleRef.current;
          currentPoints.current.push({
            x: e.nativeEvent.locationX * s,
            y: e.nativeEvent.locationY * s,
          });
          setLivePoints(currentPoints.current.slice());
        },
        onPanResponderRelease: () => {
          if (currentPoints.current.length > 0) {
            onChangeRef.current([
              ...strokesRef.current,
              {
                color: colorRef.current,
                // Widths live in the authored space too, so they scale with it.
                width: widthRef.current * scaleRef.current,
                points: currentPoints.current,
              },
            ]);
          }
          currentPoints.current = [];
          setLivePoints([]);
          onActiveRef.current?.(false);
        },
        onPanResponderTerminate: () => {
          currentPoints.current = [];
          setLivePoints([]);
          onActiveRef.current?.(false);
        },
      }),
    [],
  );

  return (
    <View
      {...responder.panHandlers}
      onLayout={onLayout}
      style={[
        styles.canvas,
        {
          height,
          backgroundColor: background ?? theme.backgroundElement,
          borderColor: theme.backgroundSelected,
        },
      ]}>
      {layoutWidth > 0 && (
        <Svg
          width="100%"
          height={height}
          viewBox={`0 0 ${docWidth} ${viewBoxHeight}`}
          preserveAspectRatio="xMidYMin meet">
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
          {livePoints.length > 0 && (
            <Path
              d={pointsToPath(livePoints)}
              stroke={color}
              strokeWidth={strokeWidth * scale}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </Svg>
      )}
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
