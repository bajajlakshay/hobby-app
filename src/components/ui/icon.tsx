import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ColorValue, StyleProp, ViewStyle } from 'react-native';

/**
 * Semantic icon names used across the app, mapped to SF Symbols on iOS and
 * Material Symbols on Android/web (both ship with expo-symbols).
 */
const ICONS = {
  back: { ios: 'chevron.left', android: 'arrow_back_ios_new', web: 'arrow_back_ios_new' },
  pin: { ios: 'pin.fill', android: 'keep', web: 'keep' },
  palette: { ios: 'paintpalette', android: 'palette', web: 'palette' },
  archive: { ios: 'archivebox', android: 'archive', web: 'archive' },
  unarchive: { ios: 'tray.and.arrow.up', android: 'unarchive', web: 'unarchive' },
  trash: { ios: 'trash', android: 'delete', web: 'delete' },
  deleteForever: { ios: 'trash.slash', android: 'delete_forever', web: 'delete_forever' },
  restore: { ios: 'arrow.counterclockwise', android: 'restore_from_trash', web: 'restore_from_trash' },
  add: { ios: 'plus', android: 'add', web: 'add' },
  close: { ios: 'xmark', android: 'close', web: 'close' },
  logout: { ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' },
  settings: { ios: 'gearshape', android: 'settings', web: 'settings' },
  person: { ios: 'person.circle', android: 'person', web: 'person' },
  offline: { ios: 'wifi.slash', android: 'cloud_off', web: 'cloud_off' },
  sync: { ios: 'arrow.triangle.2.circlepath', android: 'sync', web: 'sync' },
  textNote: { ios: 'doc.text', android: 'text_snippet', web: 'text_snippet' },
  drawing: { ios: 'scribble', android: 'stylus_note', web: 'stylus_note' },
  undo: { ios: 'arrow.uturn.backward', android: 'undo', web: 'undo' },
  eye: { ios: 'eye', android: 'visibility', web: 'visibility' },
  edit: { ios: 'pencil', android: 'edit', web: 'edit' },
} as const satisfies Record<string, SymbolViewProps['name']>;

export type IconName = keyof typeof ICONS;

type IconProps = {
  name: IconName;
  /** Symbol size in points. @default 22 */
  size?: number;
  color: ColorValue;
  style?: StyleProp<ViewStyle>;
};

export function Icon({ name, size = 22, color, style }: IconProps) {
  return <SymbolView name={ICONS[name]} size={size} tintColor={color} style={style} />;
}
