import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {Button, Text} from 'react-native-paper';
import {observer} from 'mobx-react';
import {useNavigation} from '@react-navigation/native';

import {SearchIcon, XIcon} from '../../assets/icons';
import {useChatSearch, useTheme} from '../../hooks';
import {L10nContext} from '../../utils';
import {chatSessionStore} from '../../store';
import {chatRunControl} from '../../services/chatRunControl';
import {ChatSearchResult, TextRange} from '../../utils/chatSearch';
import {ROUTES} from '../../utils/navigationConstants';
import {createStyles} from './styles';

const HighlightedText = ({
  text,
  ranges,
  styles,
}: {
  text: string;
  ranges: TextRange[];
  styles: ReturnType<typeof createStyles>;
}) => {
  const children: React.ReactNode[] = [];
  let cursor = 0;
  ranges.forEach((range, index) => {
    if (range.start > cursor) {
      children.push(text.slice(cursor, range.start));
    }
    children.push(
      <Text
        key={`${range.start}-${range.end}-${index}`}
        style={styles.highlight}>
        {text.slice(range.start, range.end)}
      </Text>,
    );
    cursor = range.end;
  });
  children.push(text.slice(cursor));
  return <>{children}</>;
};

export const SearchChatsScreen: React.FC = observer(() => {
  const theme = useTheme();
  const styles = createStyles(theme);
  const l10n = React.useContext(L10nContext);
  const navigation = useNavigation<any>();
  const search = useChatSearch();
  const [openingId, setOpeningId] = React.useState<string | null>(null);
  const [openError, setOpenError] = React.useState<string | null>(null);

  const openResult = React.useCallback(
    async (result: ChatSearchResult) => {
      if (openingId) {
        return;
      }
      Keyboard.dismiss();
      search.cancel();
      setOpeningId(result.sessionId);
      setOpenError(null);
      try {
        await chatRunControl.stopForSessionSwitch();
        await chatSessionStore.setActiveSession(result.sessionId);
        chatSessionStore.setSearchReturnAvailable(true);
        navigation.navigate(ROUTES.CHAT);
      } catch (error) {
        console.error('Failed to open chat search result:', error);
        setOpenError(l10n.searchChats.openError);
        search.refresh();
      } finally {
        setOpeningId(null);
      }
    },
    [l10n.searchChats.openError, navigation, openingId, search],
  );

  const renderResult = React.useCallback(
    ({item}: {item: ChatSearchResult}) => (
      <TouchableOpacity
        testID={`chat-search-result-${item.sessionId}`}
        accessibilityRole="button"
        accessibilityLabel={`${item.title}, ${item.occurrenceCount} ${l10n.searchChats.matches}`}
        disabled={openingId !== null}
        onPress={() => openResult(item)}
        style={styles.row}>
        <View style={styles.rowHeader}>
          <Text numberOfLines={1} style={styles.rowTitle}>
            <HighlightedText
              text={item.title}
              ranges={item.titleRanges}
              styles={styles}
            />
          </Text>
          <Text style={styles.rowDate}>
            {new Date(item.latestActivityAt).toLocaleDateString()}
          </Text>
        </View>
        {!!item.excerpt && (
          <Text numberOfLines={2} style={styles.excerpt}>
            <HighlightedText
              text={item.excerpt}
              ranges={item.excerptRanges}
              styles={styles}
            />
          </Text>
        )}
        <Text style={styles.score}>
          {item.occurrenceCount} {l10n.searchChats.matches}
        </Text>
      </TouchableOpacity>
    ),
    [l10n.searchChats.matches, openResult, openingId, styles],
  );

  const renderBody = () => {
    if (search.status === 'blank') {
      return (
        <View style={styles.centered}>
          <SearchIcon width={42} height={42} stroke={theme.colors.primary} />
          <Text style={styles.stateTitle}>{l10n.searchChats.blankTitle}</Text>
          <Text style={styles.stateText}>{l10n.searchChats.blankMessage}</Text>
        </View>
      );
    }
    if (search.status === 'error') {
      return (
        <View style={styles.centered}>
          <Text style={styles.stateTitle}>{l10n.searchChats.errorTitle}</Text>
          <Text style={styles.stateText}>{l10n.searchChats.errorMessage}</Text>
          <Button
            mode="contained"
            style={styles.action}
            onPress={search.refresh}>
            {l10n.searchChats.retry}
          </Button>
        </View>
      );
    }
    if (search.status === 'searching') {
      return (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.stateTitle}>{l10n.searchChats.searching}</Text>
          <Text style={styles.stateText}>
            {l10n.searchChats.recordsVisited.replace(
              '{{count}}',
              String(search.recordsVisited),
            )}
          </Text>
          {search.partialAvailable && (
            <Button
              mode="outlined"
              style={styles.action}
              onPress={search.revealPartial}>
              {l10n.searchChats.showPartial}
            </Button>
          )}
        </View>
      );
    }
    if (search.status === 'complete' && search.results.length === 0) {
      return (
        <View style={styles.centered}>
          <Text style={styles.stateTitle}>{l10n.searchChats.noResults}</Text>
          <Text style={styles.stateText}>
            {l10n.searchChats.noResultsMessage}
          </Text>
          <Button
            mode="text"
            style={styles.action}
            onPress={() => search.setQuery('')}>
            {l10n.searchChats.clear}
          </Button>
        </View>
      );
    }
    return (
      <>
        {search.status === 'partial' && (
          <View style={styles.progressBanner} accessibilityRole="alert">
            <Text style={styles.progressText}>
              {l10n.searchChats.partialWarning}
            </Text>
          </View>
        )}
        <Text style={styles.resultCount}>
          {(search.results.length === 1
            ? l10n.searchChats.resultCountOne
            : l10n.searchChats.resultCount
          ).replace('{{count}}', String(search.results.length))}
        </Text>
        <FlatList
          testID="chat-search-results"
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={search.results}
          keyExtractor={item => item.sessionId}
          renderItem={renderResult}
          keyboardShouldPersistTaps="handled"
        />
      </>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.searchBar}>
          <SearchIcon
            width={20}
            height={20}
            stroke={theme.colors.onSurfaceVariant}
          />
          <TextInput
            testID="chat-search-input"
            style={styles.input}
            value={search.query}
            onChangeText={search.setQuery}
            placeholder={l10n.searchChats.placeholder}
            placeholderTextColor={theme.colors.placeholder}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {!!search.query && (
            <TouchableOpacity
              accessibilityLabel={l10n.searchChats.clear}
              onPress={() => search.setQuery('')}
              style={styles.clearButton}>
              <XIcon width={18} height={18} stroke={theme.colors.primary} />
            </TouchableOpacity>
          )}
        </View>
        {!!openError && <Text style={styles.stateText}>{openError}</Text>}
        {renderBody()}
      </View>
      {!!openingId && (
        <View style={styles.openingOverlay}>
          <View style={styles.openingCard}>
            <ActivityIndicator color={theme.colors.primary} />
            <Text style={styles.stateText}>{l10n.searchChats.opening}</Text>
          </View>
        </View>
      )}
    </View>
  );
});
