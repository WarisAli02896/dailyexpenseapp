import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS } from '../../constants/colors';
import { FONTS } from '../../constants/fonts';
import { getTemplates, updateTemplate, deleteTemplate } from '../../services/recurringService';
import { useAuth } from '../../hooks/useAuth';
import { formatAmount } from '../../utils/currencyUtils';
import { showAlert, showConfirm } from '../../utils/alertUtils';
import { COMMON_MESSAGES } from '../../messages/commonMessages';
import { RECURRING_MESSAGES } from '../../../messages/recurringMessages';

const RecurringEntriesScreen = () => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const [editItem, setEditItem] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editCompany, setEditCompany] = useState('');
  const [updating, setUpdating] = useState(false);

  const loadTemplates = useCallback(async () => {
    if (!user) return;
    const result = await getTemplates(user.id);
    if (result.success) {
      setTemplates(result.data);
    } else {
      showAlert('Error', COMMON_MESSAGES.REFRESH_FAILED);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadTemplates();
    }, [loadTemplates])
  );

  const handleRefresh = async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      const result = await getTemplates(user.id);
      if (result.success) {
        setTemplates(result.data);
        showAlert('Success', COMMON_MESSAGES.REFRESH_SUCCESS);
      } else {
        showAlert('Error', COMMON_MESSAGES.REFRESH_FAILED);
      }
    } catch {
      showAlert('Error', COMMON_MESSAGES.REFRESH_FAILED);
    } finally {
      setRefreshing(false);
    }
  };

  const handleDelete = (item) => {
    showConfirm(
      'Delete Template',
      `Remove "${item.title}" from recurring list?\n\nThis will NOT affect any entries on your Home screen.`,
      async () => {
        const result = await deleteTemplate(item.id);
        if (result.success) {
          showAlert('Success', result.message || COMMON_MESSAGES.DELETE_SUCCESS);
          loadTemplates();
        } else {
          showAlert('Error', result.message || COMMON_MESSAGES.DELETE_FAILED);
        }
      }
    );
  };

  const openEdit = (item) => {
    setEditItem(item);
    setEditTitle(item.title || '');
    setEditAmount(String(item.amount || ''));
    setEditCompany(item.company_name || '');
  };

  const closeEdit = () => {
    setEditItem(null);
    setEditTitle('');
    setEditAmount('');
    setEditCompany('');
  };

  const handleAmountChange = (text) => {
    const filtered = text.replace(/[^0-9.]/g, '');
    const parts = filtered.split('.');
    setEditAmount(parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : filtered);
  };

  const handleUpdate = async () => {
    if (!editTitle.trim()) {
      showAlert('Error', RECURRING_MESSAGES.TITLE_REQUIRED);
      return;
    }
    if (!editAmount.trim() || parseFloat(editAmount) <= 0) {
      showAlert('Error', RECURRING_MESSAGES.AMOUNT_INVALID);
      return;
    }

    setUpdating(true);
    const result = await updateTemplate(editItem.id, {
      title: editTitle.trim(),
      amount: parseFloat(editAmount),
      companyName: editCompany.trim() || null,
    });

    if (result.success) {
      showAlert('Success', result.message || COMMON_MESSAGES.UPDATE_SUCCESS);
      closeEdit();
      loadTemplates();
    } else {
      showAlert('Error', result.message || COMMON_MESSAGES.UPDATE_FAILED);
    }
    setUpdating(false);
  };

  const totalEarnings = templates.filter((t) => t.type === 'earning').reduce((s, t) => s + t.amount, 0);
  const totalSpendings = templates.filter((t) => t.type === 'spending').reduce((s, t) => s + t.amount, 0);

  const renderTemplate = ({ item }) => {
    const isEarning = item.type === 'earning';

    return (
      <View style={styles.entryRow}>
        <View style={[styles.typeIndicator, isEarning ? styles.earningIndicator : styles.spendingIndicator]} />

        <View style={styles.entryIconWrap}>
          <Ionicons
            name={isEarning ? 'arrow-down-circle' : 'arrow-up-circle'}
            size={28}
            color={isEarning ? COLORS.income : COLORS.expense}
          />
        </View>

        <View style={styles.entryDetails}>
          <Text style={styles.entryTitle} numberOfLines={1}>{item.title}</Text>
          <View style={styles.entryMeta}>
            <Text style={styles.entryMetaText}>{item.entry_type}</Text>
            <View style={styles.recurringTag}>
              <Ionicons name="repeat" size={10} color={COLORS.primary} />
              <Text style={styles.recurringTagText}>Monthly</Text>
            </View>
          </View>
          {item.company_name ? (
            <Text style={styles.entryCompany} numberOfLines={1}>{item.company_name}</Text>
          ) : null}
        </View>

        <Text style={[styles.entryAmount, isEarning ? styles.earningAmt : styles.spendingAmt]}>
          Rs. {formatAmount(item.amount)}
        </Text>

        <View style={styles.entryActions}>
          <Pressable
            style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
            onPress={() => openEdit(item)}
            role="button"
            hitSlop={6}
          >
            <Ionicons name="create-outline" size={18} color={COLORS.primary} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.actionBtn, pressed && styles.deleteBtnPressed]}
            onPress={() => handleDelete(item)}
            role="button"
            hitSlop={6}
          >
            <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Ionicons name="information-circle-outline" size={18} color={COLORS.primary} />
        <Text style={styles.infoBannerText}>
          This is your tracking list. Editing or deleting here does NOT affect entries on your Home screen.
        </Text>
      </View>

      {/* Summary */}
      {templates.length > 0 && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <View style={[styles.summaryDot, { backgroundColor: COLORS.income + '20' }]}>
              <Ionicons name="arrow-down-circle" size={18} color={COLORS.income} />
            </View>
            <View>
              <Text style={styles.summaryLabel}>Monthly Earnings</Text>
              <Text style={[styles.summaryValue, { color: COLORS.income }]}>
                Rs. {formatAmount(totalEarnings)}
              </Text>
            </View>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <View style={[styles.summaryDot, { backgroundColor: COLORS.expense + '20' }]}>
              <Ionicons name="arrow-up-circle" size={18} color={COLORS.expense} />
            </View>
            <View>
              <Text style={styles.summaryLabel}>Monthly Spendings</Text>
              <Text style={[styles.summaryValue, { color: COLORS.expense }]}>
                Rs. {formatAmount(totalSpendings)}
              </Text>
            </View>
          </View>
        </View>
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recurring Templates</Text>
        <Text style={styles.sectionCount}>{templates.length}</Text>
      </View>

      <FlatList
        data={templates}
        renderItem={renderTemplate}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary} colors={[COLORS.primary]} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="repeat-outline" size={60} color={COLORS.textLight} />
            <Text style={styles.emptyTitle}>No recurring entries</Text>
            <Text style={styles.emptyText}>
              When you add a salary with "Monthly Recurring" toggled on, it will appear here for tracking
            </Text>
          </View>
        }
      />

      {/* Edit Modal */}
      <Modal visible={!!editItem} transparent animationType="fade" onRequestClose={closeEdit}>
        <Pressable style={styles.overlay} onPress={closeEdit}>
          <Pressable style={styles.modal} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Update Template</Text>
              <Pressable onPress={closeEdit} role="button">
                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
              </Pressable>
            </View>

            {editItem && (
              <View style={styles.modalBody}>
                <View style={styles.modalNote}>
                  <Ionicons name="shield-checkmark-outline" size={16} color={COLORS.income} />
                  <Text style={styles.modalNoteText}>
                    Your existing Home screen entries will NOT be changed
                  </Text>
                </View>

                <View style={styles.modalField}>
                  <Text style={styles.fieldLabel}>Title</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={editTitle}
                    onChangeText={setEditTitle}
                    placeholder="Entry title"
                    placeholderTextColor={COLORS.textLight}
                  />
                </View>

                <View style={styles.modalField}>
                  <Text style={styles.fieldLabel}>Amount</Text>
                  <View style={styles.amountRow}>
                    <View style={styles.currencyTag}>
                      <Text style={styles.currencyText}>Rs.</Text>
                    </View>
                    <TextInput
                      style={[styles.fieldInput, styles.amountInput]}
                      value={editAmount}
                      onChangeText={handleAmountChange}
                      placeholder="0.00"
                      placeholderTextColor={COLORS.textLight}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                {editItem.entry_type === 'salary' && (
                  <View style={styles.modalField}>
                    <Text style={styles.fieldLabel}>Company</Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={editCompany}
                      onChangeText={setEditCompany}
                      placeholder="Company name"
                      placeholderTextColor={COLORS.textLight}
                    />
                  </View>
                )}

                <View style={styles.modalActions}>
                  <Pressable
                    style={({ pressed }) => [styles.modalCancelBtn, pressed && { opacity: 0.7 }]}
                    onPress={closeEdit}
                    role="button"
                  >
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.modalSaveBtn, pressed && { opacity: 0.8 }, updating && { opacity: 0.5 }]}
                    onPress={handleUpdate}
                    disabled={updating}
                    role="button"
                  >
                    <Ionicons name="checkmark" size={18} color={COLORS.textWhite} />
                    <Text style={styles.modalSaveText}>Update</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 20,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '10',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.primary + '18',
  },
  infoBannerText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.primary,
    flex: 1,
    lineHeight: 18,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  summaryItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  summaryDot: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.bold,
  },
  summaryDivider: {
    width: 1,
    height: 36,
    backgroundColor: COLORS.borderLight,
    marginHorizontal: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.text,
  },
  sectionCount: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  listContent: {
    paddingBottom: 30,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.06)',
  },
  typeIndicator: {
    width: 4,
    height: '100%',
    minHeight: 40,
    borderRadius: 2,
    position: 'absolute',
    left: 0,
    top: 10,
    bottom: 10,
  },
  earningIndicator: {
    backgroundColor: COLORS.income,
  },
  spendingIndicator: {
    backgroundColor: COLORS.expense,
  },
  entryIconWrap: {
    marginLeft: 6,
    marginRight: 12,
  },
  entryDetails: {
    flex: 1,
    marginRight: 8,
  },
  entryTitle: {
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.text,
    marginBottom: 3,
  },
  entryMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  entryMetaText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  recurringTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '12',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 3,
  },
  recurringTagText: {
    fontSize: 10,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.primary,
  },
  entryCompany: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textLight,
    marginTop: 2,
  },
  entryAmount: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.bold,
    marginRight: 6,
  },
  earningAmt: {
    color: COLORS.income,
  },
  spendingAmt: {
    color: COLORS.expense,
  },
  entryActions: {
    gap: 4,
  },
  actionBtn: {
    padding: 5,
    borderRadius: 8,
  },
  actionBtnPressed: {
    backgroundColor: COLORS.primary + '12',
  },
  deleteBtnPressed: {
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.textSecondary,
    marginTop: 14,
  },
  emptyText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textLight,
    marginTop: 6,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  overlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    padding: 24,
  },
  modal: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  modalTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.text,
  },
  modalBody: {
    padding: 20,
  },
  modalNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.income + '10',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    gap: 8,
  },
  modalNoteText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.income,
    flex: 1,
  },
  modalField: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.medium,
    color: COLORS.text,
    marginBottom: 6,
  },
  fieldInput: {
    fontSize: FONTS.sizes.base,
    color: COLORS.text,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  currencyTag: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 12,
  },
  currencyText: {
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textWhite,
  },
  amountInput: {
    flex: 1,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
  modalCancelBtn: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
  },
  modalCancelText: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.medium,
    color: COLORS.textSecondary,
  },
  modalSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  modalSaveText: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.textWhite,
  },
});

export default RecurringEntriesScreen;
