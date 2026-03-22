import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { FONTS } from '../../constants/fonts';
import { Button } from '../common';
import { formatAmount } from '../../utils/currencyUtils';
import { showAlert } from '../../utils/alertUtils';
import { repayDuePartial } from '../../services/entryService';
import { DUE_MESSAGES } from '../../messages/dueMessages';

const filterNumeric = (text) => {
  const cleaned = text.replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  return parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : cleaned;
};

const DueRepayModal = ({ visible, onClose, userId, dueEntry, remaining, onSaved }) => {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible || !dueEntry) return;
    const r = Number(remaining);
    setAmount(Number.isFinite(r) && r > 0 ? String(r) : '');
    setNote('');
  }, [visible, dueEntry?.id, remaining]);

  const handleSubmit = async () => {
    if (!userId || !dueEntry) return;
    const rem = Number(remaining);
    const amt = Number(amount);
    if (!amount.trim() || !Number.isFinite(amt) || amt <= 0) {
      showAlert('Error', DUE_MESSAGES.REPAY_AMOUNT_INVALID);
      return;
    }
    if (amt > rem + 0.0001) {
      showAlert('Error', DUE_MESSAGES.REPAY_EXCEEDS_REMAINING);
      return;
    }
    if (!note.trim()) {
      showAlert('Error', DUE_MESSAGES.REPAY_NOTE_REQUIRED);
      return;
    }

    setSaving(true);
    try {
      const result = await repayDuePartial({
        userId,
        dueEntryId: dueEntry.id,
        amount: amt,
        note: note.trim(),
        date: undefined,
      });
      if (result.success) {
        showAlert('Success', result.message || DUE_MESSAGES.REPAY_SUCCESS_PARTIAL);
        onSaved?.();
        onClose();
      } else {
        showAlert('Error', result.message || DUE_MESSAGES.REPAY_FAILED);
      }
    } catch {
      showAlert('Error', DUE_MESSAGES.REPAY_FAILED);
    } finally {
      setSaving(false);
    }
  };

  if (!dueEntry) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{DUE_MESSAGES.REPAY_MODAL_TITLE}</Text>
              <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button">
                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
              </Pressable>
            </View>
            <Text style={styles.sheetSubtitle} numberOfLines={2}>
              {dueEntry.title}
            </Text>
            <Text style={styles.remainLine}>
              {DUE_MESSAGES.REPAY_REMAINING_LABEL}:{' '}
              <Text style={styles.remainValue}>Rs. {formatAmount(Number(remaining) || 0)}</Text>
            </Text>
            <Text style={styles.fieldLabel}>{DUE_MESSAGES.REPAY_AMOUNT_LABEL}</Text>
            <Text style={styles.hint}>{DUE_MESSAGES.REPAY_AMOUNT_HINT}</Text>
            <View style={styles.inputRow}>
              <Text style={styles.currency}>Rs.</Text>
              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={(t) => setAmount(filterNumeric(t))}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={COLORS.textLight}
              />
            </View>

            <Text style={[styles.fieldLabel, styles.fieldLabelSpaced]}>{DUE_MESSAGES.REPAY_NOTE_LABEL}</Text>
            <TextInput
              style={styles.noteInput}
              value={note}
              onChangeText={setNote}
              placeholder={DUE_MESSAGES.REPAY_NOTE_PLACEHOLDER}
              placeholderTextColor={COLORS.textLight}
              multiline
            />

            <View style={styles.actions}>
              <View style={styles.actionSlot}>
                <Button
                  title={DUE_MESSAGES.CANCEL}
                  variant="outline"
                  size="md"
                  onPress={onClose}
                  style={styles.actionBtnFill}
                />
              </View>
              <View style={styles.actionSlot}>
                <Button
                  title={DUE_MESSAGES.REPAY_SUBMIT}
                  size="md"
                  onPress={handleSubmit}
                  loading={saving}
                  style={[styles.actionBtnFill, styles.actionBtnFillPrimary]}
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    maxHeight: '88%',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sheetTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.text,
    flex: 1,
  },
  sheetSubtitle: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  remainLine: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    marginBottom: 14,
  },
  remainValue: {
    fontWeight: FONTS.weights.bold,
    color: COLORS.warning,
  },
  fieldLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.text,
    marginBottom: 6,
  },
  fieldLabelSpaced: { marginTop: 14 },
  hint: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textLight,
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: COLORS.background,
  },
  currency: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    marginRight: 6,
  },
  input: {
    flex: 1,
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.text,
    paddingVertical: 12,
  },
  noteInput: {
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.background,
    fontSize: FONTS.sizes.md,
    color: COLORS.text,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    marginTop: 22,
    columnGap: 10,
    gap: 10,
  },
  actionSlot: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
  },
  actionBtnFill: {
    width: '100%',
    minHeight: 52,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  actionBtnFillPrimary: {
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
});

export default DueRepayModal;
