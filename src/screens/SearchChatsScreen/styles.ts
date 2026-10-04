import {StyleSheet} from 'react-native';
import type {Theme} from '../../utils/types';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: 14,
    },
    searchBar: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      borderRadius: theme.borders.default,
      backgroundColor: theme.colors.searchBarBackground,
    },
    input: {
      flex: 1,
      color: theme.colors.onSurface,
      fontSize: 16,
      paddingVertical: 10,
    },
    clearButton: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 18,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    stateTitle: {
      marginTop: 16,
      color: theme.colors.onSurface,
      fontSize: 18,
      fontWeight: '600',
      textAlign: 'center',
    },
    stateText: {
      marginTop: 8,
      color: theme.colors.onSurfaceVariant,
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
    },
    action: {
      marginTop: 16,
    },
    progressBanner: {
      marginTop: 12,
      padding: 12,
      borderRadius: 8,
      backgroundColor: theme.colors.surfaceContainerHighest,
    },
    progressText: {
      color: theme.colors.onSurfaceVariant,
      fontSize: 13,
      lineHeight: 18,
    },
    resultCount: {
      paddingVertical: 12,
      color: theme.colors.onSurfaceVariant,
      fontSize: 13,
      fontWeight: '600',
    },
    list: {
      flex: 1,
    },
    listContent: {
      paddingBottom: 24,
    },
    row: {
      paddingVertical: 14,
      paddingHorizontal: 4,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.outline,
    },
    rowHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    rowTitle: {
      flex: 1,
      color: theme.colors.onSurface,
      fontSize: 15,
      fontWeight: '600',
    },
    rowDate: {
      color: theme.colors.onSurfaceVariant,
      fontSize: 11,
    },
    excerpt: {
      marginTop: 5,
      color: theme.colors.onSurfaceVariant,
      fontSize: 13,
      lineHeight: 19,
    },
    highlight: {
      color: theme.colors.onSurface,
      backgroundColor: theme.colors.accent.peach,
      fontWeight: '700',
    },
    score: {
      marginTop: 5,
      color: theme.colors.onSurfaceVariant,
      fontSize: 11,
    },
    openingOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.backdrop,
    },
    openingCard: {
      minWidth: 220,
      alignItems: 'center',
      padding: 20,
      borderRadius: theme.borders.default,
      backgroundColor: theme.colors.surface,
    },
  });
