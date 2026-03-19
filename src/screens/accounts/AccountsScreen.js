import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { COLORS } from '../../constants/colors';
import { FONTS } from '../../constants/fonts';
import { useAuth } from '../../hooks/useAuth';
import { addPerson, getPersons, deletePerson, setPersonLock, setActivePerson } from '../../services/personService';
import { formatAmount } from '../../utils/currencyUtils';
import { showAlert, showConfirm } from '../../utils/alertUtils';
import { ACCOUNT_MESSAGES } from '../../messages/accountMessages';
import { COMMON_MESSAGES } from '../../messages/commonMessages';
import { exportSummaryReportPdf } from '../../services/pdfReportService';

const INVEST_COLOR = '#7C4DFF';
const formatSignedRupee = (value) => `${value >= 0 ? '+' : '-'} Rs. ${formatAmount(Math.abs(value || 0))}`;

const AccountsScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [persons, setPersons] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const loadPersons = useCallback(async () => {
    if (!user) return;
    const result = await getPersons(user.id);
    if (result.success) {
      setPersons(result.data);
    } else {
      showAlert('Error', ACCOUNT_MESSAGES.REFRESH_FAILED);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadPersons();
    }, [loadPersons])
  );

  const selectedTotal = persons
    .filter((p) => selectedIds.includes(p.id))
    .reduce((sum, p) => sum + (p.total_invested || 0), 0);
  const selectedAccounts = persons.filter((p) => selectedIds.includes(p.id));

  const toggleSelection = (personId) => {
    setSelectedIds((prev) => (
      prev.includes(personId) ? prev.filter((id) => id !== personId) : [...prev, personId]
    ));
  };

  const handleAdd = async () => {
    if (!newName.trim()) {
      showAlert('Error', ACCOUNT_MESSAGES.PERSON_NAME_REQUIRED);
      return;
    }

    setAdding(true);
    const result = await addPerson(user.id, newName);
    if (result.success) {
      setNewName('');
      setShowInput(false);
      showAlert('Success', ACCOUNT_MESSAGES.ADD_SUCCESS);
      loadPersons();
    } else {
      showAlert('Error', result.message || ACCOUNT_MESSAGES.ADD_FAILED);
    }
    setAdding(false);
  };

  const handleDelete = (e, person) => {
    e.stopPropagation();
    showConfirm(
      'Delete Account',
      `Remove "${person.name}" from your accounts?`,
      async () => {
        const result = await deletePerson(person.id);
        if (result.success) {
          showAlert('Success', ACCOUNT_MESSAGES.DELETE_SUCCESS);
          loadPersons();
        } else {
          showAlert('Error', result.message || ACCOUNT_MESSAGES.DELETE_FAILED);
        }
      }
    );
  };

  const handleToggleLock = async (e, person) => {
    e.stopPropagation();
    const nextLocked = person.is_locked !== 1;
    const result = await setPersonLock(person.id, nextLocked);
    if (result.success) {
      showAlert('Success', ACCOUNT_MESSAGES.LOCK_UPDATED);
      loadPersons();
    } else {
      showAlert('Error', result.message || ACCOUNT_MESSAGES.LOCK_UPDATE_FAILED);
    }
  };

  const handleSetActive = async (e, person) => {
    e.stopPropagation();
    if (person.is_active === 1) return;

    const result = await setActivePerson(user.id, person.id);
    if (result.success) {
      showAlert('Success', ACCOUNT_MESSAGES.ACTIVE_SET_SUCCESS);
      loadPersons();
    } else {
      showAlert('Error', result.message || ACCOUNT_MESSAGES.ACTIVE_SET_FAILED);
    }
  };

  const handlePersonPress = (person) => {
    if (selectedIds.length > 0) {
      toggleSelection(person.id);
      return;
    }
    navigation.navigate('AccountSummary', { person });
  };

  const handlePersonLongPress = (person) => {
    toggleSelection(person.id);
  };

  const handleExportSelectedPdf = async () => {
    if (selectedAccounts.length === 0) {
      showAlert('Error', ACCOUNT_MESSAGES.SELECT_ACCOUNTS_FOR_PDF);
      return;
    }

    try {
      setExportingPdf(true);
      const result = await exportSummaryReportPdf({
        title: 'Selected Accounts Report',
        subtitle: 'Investment total for selected accounts',
        metaLines: [
          `Selected accounts: ${selectedAccounts.length}`,
        ],
        totals: [
          { label: 'Selected Accounts Total', value: formatSignedRupee(selectedTotal) },
        ],
        rows: selectedAccounts.map((account) => ({
          label: account.name,
          value: formatSignedRupee(account.total_invested || 0),
        })),
        fileName: `selected-accounts-${Date.now()}`,
      });
      if (result.success) {
        showAlert('Success', result.message || COMMON_MESSAGES.PDF_EXPORT_SUCCESS);
      } else {
        showAlert('Error', result.message || COMMON_MESSAGES.PDF_EXPORT_FAILED);
      }
    } catch (error) {
      showAlert('Error', COMMON_MESSAGES.PDF_EXPORT_FAILED);
    } finally {
      setExportingPdf(false);
    }
  };

  const getInitial = (name) => name.charAt(0).toUpperCase();

  const AVATAR_COLORS = ['#6C63FF', '#FF6584', '#4ECDC4', '#45B7D1', '#FF9800', '#7C4DFF', '#4CAF50', '#E53935'];

  const renderPerson = ({ item, index }) => {
    const bgColor = AVATAR_COLORS[index % AVATAR_COLORS.length];
    const totalInvested = item.total_invested || 0;
    const amountColor = totalInvested >= 0 ? COLORS.income : COLORS.expense;
    const entryCount = item.entry_count || 0;
    const isDefault = item.is_default === 1;
    const isLocked = item.is_locked === 1;
    const isActive = item.is_active === 1;
    const isSelected = selectedIds.includes(item.id);

    return (
      <Pressable
        style={({ pressed }) => [
          styles.personRow,
          isSelected && styles.personRowSelected,
          pressed && styles.personRowPressed,
        ]}
        onPress={() => handlePersonPress(item)}
        onLongPress={() => handlePersonLongPress(item)}
        delayLongPress={250}
        role="button"
      >
        <View style={[styles.avatar, { backgroundColor: bgColor }]}>
          <Text style={styles.avatarText}>{getInitial(item.name)}</Text>
        </View>
        <View style={styles.personInfo}>
          <View style={styles.personNameRow}>
            <Text style={styles.personName}>{item.name}</Text>
            {isDefault ? (
              <View style={styles.defaultBadge}>
                <Text style={styles.defaultBadgeText}>Default</Text>
              </View>
            ) : null}
            {isActive ? (
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>Active</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.personMeta}>
            {entryCount} {entryCount === 1 ? 'investment' : 'investments'}
          </Text>
        </View>
        <View style={styles.personAmountWrap}>
          <Text style={[styles.personAmount, { color: amountColor }]}>{formatSignedRupee(totalInvested)}</Text>
          <View style={styles.personRowRight}>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textLight} />
          </View>
        </View>
        <View style={styles.rowActions}>
          <Pressable
            style={({ pressed }) => [
              styles.activeBtn,
              isActive && styles.activeBtnSelected,
              pressed && !isActive && styles.activeBtnPressed,
            ]}
            onPress={(e) => handleSetActive(e, item)}
            role="button"
            hitSlop={8}
          >
            <Ionicons
              name={isActive ? 'checkmark-circle' : 'ellipse-outline'}
              size={19}
              color={isActive ? COLORS.primary : COLORS.textSecondary}
            />
          </Pressable>
          {isDefault ? (
            <View style={styles.lockBtn}>
              <Ionicons name="lock-closed-outline" size={16} color={COLORS.textLight} />
            </View>
          ) : (
            <>
              <Pressable
                style={({ pressed }) => [styles.lockToggleBtn, pressed && styles.lockTogglePressed]}
                onPress={(e) => handleToggleLock(e, item)}
                role="button"
                hitSlop={8}
              >
                <Ionicons
                  name={isLocked ? 'lock-closed-outline' : 'lock-open-outline'}
                  size={17}
                  color={isLocked ? COLORS.primary : COLORS.textSecondary}
                />
              </Pressable>
              {!isLocked ? (
                <Pressable
                  style={({ pressed }) => [styles.deleteBtn, pressed && styles.deleteBtnPressed]}
                  onPress={(e) => handleDelete(e, item)}
                  role="button"
                  hitSlop={8}
                >
                  <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                </Pressable>
              ) : null}
            </>
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Accounts</Text>
          <Text style={styles.subtitle}>
            {selectedIds.length > 0 ? `${selectedIds.length} selected` : 'Long press to select accounts'}
          </Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{persons.length}</Text>
        </View>
      </View>

      {/* Selected Total Card */}
      {selectedIds.length > 0 && (
        <View style={styles.totalCard}>
          <View style={styles.totalCardLeft}>
            <Ionicons name="wallet-outline" size={22} color={INVEST_COLOR} />
            <View>
              <Text style={styles.totalLabel}>Selected Accounts Total</Text>
              <Text style={[
                styles.totalAmount,
                { color: selectedTotal >= 0 ? COLORS.income : COLORS.expense },
              ]}>{formatSignedRupee(selectedTotal)}</Text>
            </View>
          </View>
          <Pressable
            onPress={handleExportSelectedPdf}
            style={({ pressed }) => [
              styles.exportPdfBtn,
              pressed && { opacity: 0.7 },
              exportingPdf && { opacity: 0.5 },
            ]}
            role="button"
            disabled={exportingPdf}
          >
            <Ionicons name="document-text-outline" size={14} color={INVEST_COLOR} />
            <Text style={styles.exportPdfText}>{exportingPdf ? 'Exporting...' : 'PDF'}</Text>
          </Pressable>
          <Pressable
            onPress={() => setSelectedIds([])}
            style={({ pressed }) => [styles.clearSelectionBtn, pressed && { opacity: 0.7 }]}
            role="button"
          >
            <Text style={styles.clearSelectionText}>Clear</Text>
          </Pressable>
        </View>
      )}

      {/* Add Person */}
      {showInput ? (
        <View style={styles.addCard}>
          <TextInput
            style={styles.addInput}
            value={newName}
            onChangeText={setNewName}
            placeholder="Enter person name"
            placeholderTextColor={COLORS.textLight}
            autoFocus
            onSubmitEditing={handleAdd}
          />
          <View style={styles.addActions}>
            <Pressable
              style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.7 }]}
              onPress={() => { setShowInput(false); setNewName(''); }}
              role="button"
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.8 }, adding && { opacity: 0.5 }]}
              onPress={handleAdd}
              disabled={adding}
              role="button"
            >
              <Ionicons name="checkmark" size={18} color={COLORS.textWhite} />
              <Text style={styles.saveBtnText}>Add</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.85 }]}
          onPress={() => setShowInput(true)}
          role="button"
        >
          <Ionicons name="person-add-outline" size={20} color={COLORS.primary} />
          <Text style={styles.addBtnText}>Add New Person</Text>
        </Pressable>
      )}

      {/* Persons List */}
      <FlatList
        data={persons}
        renderItem={renderPerson}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={60} color={COLORS.textLight} />
            <Text style={styles.emptyTitle}>No accounts yet</Text>
            <Text style={styles.emptyText}>Add a person to start tracking investments</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 20,
    paddingTop: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.text,
  },
  subtitle: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  countBadge: {
    backgroundColor: COLORS.primary,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countText: {
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textWhite,
  },
  totalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: INVEST_COLOR + '10',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: INVEST_COLOR + '25',
  },
  totalCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  totalLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  totalAmount: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.extraBold,
    color: INVEST_COLOR,
    marginTop: 2,
  },
  totalPersonCount: {
    backgroundColor: INVEST_COLOR + '18',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  totalPersonCountText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.semiBold,
    color: INVEST_COLOR,
  },
  clearSelectionBtn: {
    backgroundColor: INVEST_COLOR + '18',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  clearSelectionText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.semiBold,
    color: INVEST_COLOR,
  },
  exportPdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: INVEST_COLOR + '18',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  exportPdfText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.semiBold,
    color: INVEST_COLOR,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary + '10',
    borderWidth: 1.5,
    borderColor: COLORS.primary + '30',
    borderStyle: 'dashed',
    borderRadius: 14,
    padding: 16,
    gap: 10,
    marginBottom: 16,
  },
  addBtnText: {
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.primary,
  },
  addCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
  },
  addInput: {
    fontSize: FONTS.sizes.base,
    color: COLORS.text,
    backgroundColor: COLORS.background,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  addActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  cancelBtnText: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.medium,
    color: COLORS.textSecondary,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  saveBtnText: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.textWhite,
  },
  listContent: {
    paddingBottom: 30,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.06)',
  },
  personRowPressed: {
    backgroundColor: COLORS.borderLight,
  },
  personRowSelected: {
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarText: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textWhite,
  },
  personInfo: {
    flex: 1,
  },
  personNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  personName: {
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.text,
  },
  defaultBadge: {
    backgroundColor: COLORS.primary + '14',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  defaultBadgeText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.primary,
  },
  activeBadge: {
    backgroundColor: COLORS.income + '18',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  activeBadgeText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.income,
  },
  personMeta: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  personAmountWrap: {
    alignItems: 'flex-end',
    marginRight: 6,
  },
  personAmount: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: INVEST_COLOR,
  },
  personRowRight: {
    marginTop: 2,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  activeBtn: {
    padding: 8,
    borderRadius: 10,
  },
  activeBtnSelected: {
    backgroundColor: COLORS.primary + '12',
  },
  activeBtnPressed: {
    backgroundColor: COLORS.borderLight,
  },
  lockToggleBtn: {
    padding: 8,
    borderRadius: 10,
  },
  lockTogglePressed: {
    backgroundColor: COLORS.primary + '12',
  },
  deleteBtn: {
    padding: 8,
    borderRadius: 10,
  },
  lockBtn: {
    padding: 8,
    borderRadius: 10,
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
  },
});

export default AccountsScreen;
