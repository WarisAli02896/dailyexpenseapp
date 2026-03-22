import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { FONTS } from '../../constants/fonts';
import { Button } from '../common';
import { formatAmount } from '../../utils/currencyUtils';
import { showAlert } from '../../utils/alertUtils';
import { updateDueGroupedAmounts } from '../../services/entryService';
import { DUE_MESSAGES } from '../../messages/dueMessages';
import { ENTRY_MESSAGES } from '../../messages/entryMessages';

const filterNumeric = (text) => {
  const cleaned = text.replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  return parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : cleaned;
};

const DueAmountEditModal = ({ visible, onClose, userId, group, onSaved }) => {
  const due = group?.due;
  const repayments = group?.repayments || [];

  const earningRepayments = useMemo(
    () => repayments.filter((r) => r.entry_type === 'repayment' && r.type === 'earning'),
    [repayments]
  );

  const canEditReturned = useMemo(() => {
    if (!due || earningRepayments.length === 0) return false;
    return earningRepayments.every((r) => Number(r.repayment_for_entry_id) === Number(due.id));
  }, [due, earningRepayments]);

  const [given, setGiven] = useState('');
  const [returned, setReturned] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible || !due) return;
    setGiven(String(due.amount ?? ''));
    const er = repayments.filter((r) => r.entry_type === 'repayment' && r.type === 'earning');
    if (er.length === 1) setReturned(String(er[0].amount ?? ''));
    else setReturned('');
    // Only reseed when opening the modal for this due (avoid wiping input on parent re-renders).
  }, [visible, due?.id]);

  const handleSave = async () => {
    if (!userId || !due) return;
    const g = Number(given);
    if (!given.trim() || !Number.isFinite(g) || g <= 0) {
      showAlert('Error', DUE_MESSAGES.AMOUNT_POSITIVE);
      return;
    }

    if (canEditReturned && earningRepayments.length === 1) {
      const r = Number(returned);
      if (!returned.trim() || !Number.isFinite(r) || r <= 0) {
        showAlert('Error', DUE_MESSAGES.AMOUNT_POSITIVE);
        return;
      }
    }

    setSaving(true);
    try {
      const result = await updateDueGroupedAmounts({
        userId,
        dueEntryId: due.id,
        givenAmount: g,
        returnedAmount: canEditReturned && earningRepayments.length === 1 ? Number(returned) : undefined,
      });
      if (result.success) {
        showAlert('Success', result.message || ENTRY_MESSAGES.UPDATE_SUCCESS);
        onSaved?.();
        onClose();
      } else {
        showAlert('Error', result.message || ENTRY_MESSAGES.UPDATE_FAILED);
      }
    } catch {
      showAlert('Error', ENTRY_MESSAGES.UPDATE_FAILED);
    } finally {
      setSaving(false);
    }
  };

  if (!due) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{DUE_MESSAGES.EDIT_AMOUNTS}</Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button">
              <Ionicons name="close" size={24} color={COLORS.textSecondary} />
            </Pressable>
          </View>
          <Text style={styles.sheetSubtitle} numberOfLines={2}>
            {due.title}
          </Text>

          <Text style={styles.fieldLabel}>{DUE_MESSAGES.GIVEN_AMOUNT_LABEL}</Text>
          <View style={styles.inputRow}>
            <Text style={styles.currency}>Rs.</Text>
            <TextInput
              style={styles.input}
              value={given}
              onChangeText={(t) => setGiven(filterNumeric(t))}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={COLORS.textLight}
            />
          </View>
          <Text style={styles.hint}>Current: Rs. {formatAmount(Number(due.amount) || 0)}</Text>

          {canEditReturned && earningRepayments.length === 1 ? (
            <>
              <Text style={[styles.fieldLabel, styles.fieldLabelSpaced]}>{DUE_MESSAGES.RETURNED_AMOUNT_LABEL}</Text>
              <View style={styles.inputRow}>
                <Text style={styles.currency}>Rs.</Text>
                <TextInput
                  style={styles.input}
                  value={returned}
                  onChangeText={(t) => setReturned(filterNumeric(t))}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={COLORS.textLight}
                />
              </View>
              <Text style={styles.hint}>
                Updates the linked repayment entries (both accounts). Current: Rs.{' '}
                {formatAmount(Number(earningRepayments[0].amount) || 0)}
              </Text>
            </>
          ) : earningRepayments.length > 1 ? (
            <Text style={styles.warnText}>{DUE_MESSAGES.RETURN_AMOUNT_MULTI_REPAY}</Text>
          ) : null}

          <View style={styles.actions}>
            <Button title={DUE_MESSAGES.CANCEL} variant="outline" onPress={onClose} style={styles.actionBtn} />
            <Button
              title={DUE_MESSAGES.SAVE_AMOUNTS}
              onPress={handleSave}
              loading={saving}
              style={styles.actionBtn}
            />
          </View>
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
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.text,
    marginBottom: 6,
  },
  fieldLabelSpaced: { marginTop: 14 },
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
  hint: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textLight,
    marginTop: 4,
  },
  warnText: {
    marginTop: 12,
    fontSize: FONTS.sizes.sm,
    color: COLORS.warning,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 22,
  },
  actionBtn: { flex: 1 },
});

export default DueAmountEditModal;
