import React, {useContext, useEffect, useState} from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import {ActivityIndicator, Text, useTheme} from 'react-native-paper';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {L10nContext} from '../../utils';
import {compactChat} from '../../services/compactChat';
import {CompactionError} from '../../services/compaction';
import {modelStore} from '../../store';
import {createStyles} from '../RenameModal/styles';

interface Props {
  visible: boolean;
  sessionId: string;
  onClose: () => void;
}

export const CompactionDialog: React.FC<Props> = ({
  visible,
  sessionId,
  onClose,
}) => {
  const theme = useTheme();
  const styles = createStyles(theme);
  const {height} = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const l10n = useContext(L10nContext);
  const copy = l10n.components.compaction;
  const [guidance, setGuidance] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (visible) {
      setGuidance('');
      setError('');
    }
  }, [visible, sessionId]);

  const cancel = () => {
    if (busy) {
      modelStore.abortActiveGeneration();
    } else {
      onClose();
    }
  };
  const confirm = async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      await compactChat(sessionId, guidance, copy.summary);
      onClose();
    } catch (failure) {
      const code = failure instanceof CompactionError ? failure.code : 'failed';
      console.warn('Chat compaction failed', {code});
      setError(copy.errors[code]);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={cancel}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View
          style={[
            styles.modalContent,
            {
              flexShrink: 1,
              maxHeight: Math.max(
                160,
                height - insets.top - insets.bottom - 32,
              ),
            },
          ]}
          testID="compaction-dialog">
          <Text style={styles.modalTitle}>{copy.title}</Text>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={{flexShrink: 1}}>
            <Text style={styles.textInput}>{copy.warning}</Text>
            <TextInput
              testID="compaction-guidance"
              accessibilityLabel={copy.guidance}
              placeholder={copy.guidance}
              placeholderTextColor={theme.colors.onSurfaceVariant}
              style={styles.textInput}
              value={guidance}
              onChangeText={setGuidance}
              multiline
              editable={!busy}
            />
            {busy ? (
              <View>
                <ActivityIndicator />
                <Text style={styles.cancelText}>{copy.progress}</Text>
              </View>
            ) : null}
            {error ? (
              <Text
                testID="compaction-error"
                accessibilityRole="alert"
                style={[styles.textInput, {color: theme.colors.error}]}>
                {error}
              </Text>
            ) : null}
          </ScrollView>
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              testID="compaction-cancel"
              accessibilityRole="button"
              style={styles.cancelButton}
              onPress={cancel}>
              <Text style={styles.cancelText}>{l10n.common.cancel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="compaction-confirm"
              accessibilityRole="button"
              style={[styles.confirmButton, busy && styles.disabledButton]}
              disabled={busy}
              onPress={confirm}>
              <Text style={styles.confirmText}>{l10n.common.ok}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
