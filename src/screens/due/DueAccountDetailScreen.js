import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import DueGroupedEntryRow from '../../components/due/DueGroupedEntryRow';
import { COLORS } from '../../constants/colors';
import { FONTS } from '../../constants/fonts';
import { useAuth } from '../../hooks/useAuth';
import { getDueAccountEntries, deleteEntry, repayDueEntry } from '../../services/entryService';
import { formatAmount } from '../../utils/currencyUtils';
import { showAlert, showConfirm } from '../../utils/alertUtils';
import { DUE_MESSAGES } from '../../messages/dueMessages';

const DueAccountDetailScreen = ({ route, navigation }) => {
  const { user } = useAuth();
  const personId = Number(route?.params?.personId);
  const personName = route?.params?.personName || 'Account';
  const [entries, setEntries] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const groupedEntries = useMemo(() => {
    const dueEntries = entries.filter((e) => e.entry_type === 'due');
    const repaymentEntries = entries.filter((e) => e.entry_type === 'repayment');
    const groupMap = new Map();

    dueEntries.forEach((due) => {
      groupMap.set(due.id, { key: `due-${due.id}`, due, repayments: [] });
    });

    repaymentEntries.forEach((rep) => {
      const refId = rep.repayment_for_entry_id;
      if (refId && groupMap.has(refId)) {
        groupMap.get(refId).repayments.push(rep);
      } else {
        const candidates = Array.from(groupMap.values()).filter((g) => {
          if (!g.due) return false;
          const sameFrom = String(g.due.person_id || '') === String(rep.person_id || '');
          const sameTo = String(g.due.due_to_person_id || '') === String(rep.due_to_person_id || '');
          const sameAmount = Number(g.due.amount || 0) === Number(rep.amount || 0);
          const dueDate = new Date(g.due.date).getTime();
          const repayDate = new Date(rep.date).getTime();
          const dueBeforeRepay = Number.isFinite(dueDate) && Number.isFinite(repayDate) ? dueDate <= repayDate : true;
          return sameFrom && sameTo && sameAmount && dueBeforeRepay;
        });

        if (candidates.length > 0) {
          candidates.sort((a, b) => {
            const aDiff = Math.abs(new Date(rep.date).getTime() - new Date(a.due.date).getTime());
            const bDiff = Math.abs(new Date(rep.date).getTime() - new Date(b.due.date).getTime());
            return aDiff - bDiff;
          });
          candidates[0].repayments.push(rep);
        }
      }
    });

    const groups = Array.from(groupMap.values()).map((g) => ({
      ...g,
      repayments: g.repayments.sort((a, b) => new Date(b.date) - new Date(a.date)),
    }));

    groups.sort((a, b) => {
      const aDate = new Date((a.due && (a.due.due_date || a.due.date)) || a.repayments[0]?.date || 0);
      const bDate = new Date((b.due && (b.due.due_date || b.due.date)) || b.repayments[0]?.date || 0);
      return bDate - aDate;
    });

    return groups;
  }, [entries]);

  const totalDue = useMemo(
    () => entries.reduce((sum, e) => sum + (e.entry_type === 'repayment' ? -Number(e.amount || 0) : Number(e.amount || 0)), 0),
    [entries]
  );

  const loadData = useCallback(async () => {
    if (!user || !personId) return;
    const result = await getDueAccountEntries(user.id);
    if (result.success) {
      const accountEntries = result.data.filter((e) => Number(e.due_to_person_id) === personId);
      setEntries(accountEntries);
    } else {
      showAlert('Error', DUE_MESSAGES.FETCH_FAILED);
    }
  }, [user, personId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = useCallback(async () => {
    if (!user || !personId) return;
    setRefreshing(true);
    try {
      const result = await getDueAccountEntries(user.id);
      if (result.success) {
        const accountEntries = result.data.filter((e) => Number(e.due_to_person_id) === personId);
        setEntries(accountEntries);
      } else {
        showAlert('Error', DUE_MESSAGES.REFRESH_FAILED);
      }
    } catch {
      showAlert('Error', DUE_MESSAGES.REFRESH_FAILED);
    } finally {
      setRefreshing(false);
    }
  }, [user, personId]);

  const handleDeleteGroup = (group) => {
    if (!group?.due) return;
    showConfirm('Delete Due Entry', `Delete "${group.due.title}"?`, async () => {
      const idsToDelete = [group.due.id, ...group.repayments.map((r) => r.id)];
      let failed = false;
      for (const id of idsToDelete) {
        const result = await deleteEntry(id);
        if (!result.success) {
          failed = true;
          break;
        }
      }
      if (!failed) {
        showAlert('Success', DUE_MESSAGES.DELETE_SUCCESS);
        loadData();
      } else {
        showAlert('Error', DUE_MESSAGES.DELETE_FAILED);
      }
    });
  };

  const handleRepay = (entry) => {
    showConfirm('Repay Due Amount', DUE_MESSAGES.REPAY_CONFIRM, async () => {
      const result = await repayDueEntry({ userId: user.id, dueEntryId: entry.id });
      if (result.success) {
        showAlert('Success', DUE_MESSAGES.REPAY_SUCCESS);
        loadData();
      } else {
        showAlert('Error', result.message || DUE_MESSAGES.REPAY_FAILED);
      }
    });
  };

  const renderGroup = ({ item }) => {
    const due = item.due;
    if (!due) return null;
    const latestRepayment = item.repayments.length > 0 ? item.repayments[0] : null;

    return (
      <DueGroupedEntryRow
        due={due}
        latestRepayment={latestRepayment}
        onPress={() => navigation.navigate('EntryDetail', { entry: due })}
        onDelete={() => handleDeleteGroup(item)}
        onRepay={() => handleRepay(due)}
      />
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.summaryCard}>
        <View style={styles.summaryLeft}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{personName.charAt(0).toUpperCase()}</Text>
          </View>
          <View>
            <Text style={styles.summaryLabel}>{personName}</Text>
            <Text style={styles.summarySub}>{entries.length} Entries</Text>
          </View>
        </View>
        <Text style={[styles.summaryAmount, { color: totalDue >= 0 ? COLORS.expense : COLORS.income }]}>
          {totalDue >= 0 ? '' : '-'}Rs. {formatAmount(Math.abs(totalDue))}
        </Text>
      </View>

      <FlatList
        data={groupedEntries}
        renderItem={renderGroup}
        keyExtractor={(item) => String(item.key)}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={56} color={COLORS.textLight} />
            <Text style={styles.emptyTitle}>No due entries</Text>
            <Text style={styles.emptyText}>This account has no due history yet.</Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.warning]}
            tintColor={COLORS.warning}
          />
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, padding: 16 },
  summaryCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  summaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.warning + '26',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: COLORS.warning,
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.bold,
  },
  summaryLabel: {
    color: COLORS.text,
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.semiBold,
  },
  summarySub: {
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.xs,
    marginTop: 2,
  },
  summaryAmount: {
    fontWeight: FONTS.weights.bold,
    fontSize: FONTS.sizes.md,
  },
  listContent: { paddingBottom: 18 },
  emptyContainer: { alignItems: 'center', paddingVertical: 70 },
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
    paddingHorizontal: 12,
  },
});

export default DueAccountDetailScreen;
