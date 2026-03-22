import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import DueGroupedEntryRow from '../../components/due/DueGroupedEntryRow';
import DueAmountEditModal from '../../components/due/DueAmountEditModal';
import DueRepayModal from '../../components/due/DueRepayModal';
import { COLORS } from '../../constants/colors';
import { FONTS } from '../../constants/fonts';
import { useAuth } from '../../hooks/useAuth';
import { getDueAccountEntries, getDueAccountTotals, deleteEntry } from '../../services/entryService';
import { formatAmount } from '../../utils/currencyUtils';
import { computeDueRepayStats } from '../../utils/dueRepayUtils';
import { getMonthName } from '../../utils/dateUtils';
import { showAlert, showConfirm } from '../../utils/alertUtils';
import { DUE_MESSAGES } from '../../messages/dueMessages';

const DueAmountScreen = ({ navigation }) => {
  const { user } = useAuth();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [periodScope, setPeriodScope] = useState('month');
  const [entries, setEntries] = useState([]);
  const [accountTotals, setAccountTotals] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [amountEditGroup, setAmountEditGroup] = useState(null);
  const [repayModalGroup, setRepayModalGroup] = useState(null);

  const dueFilterOpts = useMemo(() => {
    if (periodScope === 'all') return { scope: 'all' };
    return { scope: periodScope, month, year };
  }, [periodScope, month, year]);

  const goPrevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  };

  const goNextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  };

  const goPrevYear = () => setYear((y) => y - 1);
  const goNextYear = () => setYear((y) => y + 1);

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
        // Backward compatibility for old repayment records created before reference-id support.
        // Try to infer matching due entry using account pair + amount + nearest prior date.
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

  const dueSummaryTotals = useMemo(() => {
    return groupedEntries.reduce(
      (acc, g) => {
        if (!g.due) return acc;
        const s = computeDueRepayStats(g.due, g.repayments);
        return {
          totalPrincipal: acc.totalPrincipal + s.principal,
          totalRemaining: acc.totalRemaining + s.remaining,
        };
      },
      { totalPrincipal: 0, totalRemaining: 0 }
    );
  }, [groupedEntries]);

  const repayModalStats = repayModalGroup
    ? computeDueRepayStats(repayModalGroup.due, repayModalGroup.repayments)
    : null;

  const loadData = useCallback(async () => {
    if (!user) return;
    const [entriesResult, totalsResult] = await Promise.all([
      getDueAccountEntries(user.id, dueFilterOpts),
      getDueAccountTotals(user.id, dueFilterOpts),
    ]);
    if (entriesResult.success) {
      setEntries(entriesResult.data);
      if (totalsResult.success) {
        setAccountTotals(totalsResult.data);
      }
    } else {
      showAlert('Error', DUE_MESSAGES.FETCH_FAILED);
    }
  }, [user, dueFilterOpts]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      const [entriesResult, totalsResult] = await Promise.all([
        getDueAccountEntries(user.id, dueFilterOpts),
        getDueAccountTotals(user.id, dueFilterOpts),
      ]);
      if (entriesResult.success) {
        setEntries(entriesResult.data);
        if (totalsResult.success) {
          setAccountTotals(totalsResult.data);
        }
        showAlert('Success', DUE_MESSAGES.REFRESH_SUCCESS);
      } else {
        showAlert('Error', DUE_MESSAGES.REFRESH_FAILED);
      }
    } catch {
      showAlert('Error', DUE_MESSAGES.REFRESH_FAILED);
    } finally {
      setRefreshing(false);
    }
  }, [user, dueFilterOpts]);

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

  const renderAllEntriesGroup = ({ item }) => {
    const due = item.due;
    if (!due) return null;
    const stats = computeDueRepayStats(due, item.repayments);

    return (
      <DueGroupedEntryRow
        due={due}
        latestRepayment={stats.latestRepayment}
        totalReturned={stats.totalRepaid}
        remainingDue={stats.remaining}
        showRepayButton={stats.showRepayButton}
        onPress={() => navigation.navigate('EntryDetail', { entry: due })}
        onDelete={() => handleDeleteGroup(item)}
        onRepay={() => setRepayModalGroup(item)}
        onEditAmounts={() => setAmountEditGroup(item)}
      />
    );
  };

  const renderAccountRow = ({ item }) => (
    <Pressable
      style={({ pressed }) => [styles.accountRow, pressed && { opacity: 0.86 }]}
      onPress={() =>
        navigation.navigate('DueAccountDetail', {
          personId: item.person_id,
          personName: item.person_name,
          ...(periodScope !== 'all' ? { dueFilter: { scope: periodScope, month, year } } : {}),
        })
      }
      role="button"
    >
      <View style={styles.accountAvatar}>
        <Text style={styles.accountAvatarText}>{(item.person_name || '?').charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.accountInfo}>
        <Text style={styles.accountName}>{item.person_name}</Text>
        <Text style={styles.accountMeta}>{item.due_count || 0} Due · {item.repaid_count || 0} Repaid · Tap for details</Text>
      </View>
      <Text style={[styles.accountAmount, { color: Number(item.total_due || 0) >= 0 ? COLORS.expense : COLORS.income }]}>
        {Number(item.total_due || 0) >= 0 ? '' : '-'}Rs. {formatAmount(Math.abs(Number(item.total_due || 0)))}
      </Text>
      <Ionicons name="chevron-forward" size={18} color={COLORS.textLight} style={styles.accountArrow} />
    </Pressable>
  );

  const ListHeader = () => (
    <View style={styles.headerWrap}>
      <View style={styles.filterRow}>
        {[
          { key: 'month', label: DUE_MESSAGES.FILTER_SCOPE_MONTH },
          { key: 'year', label: DUE_MESSAGES.FILTER_SCOPE_YEAR },
          { key: 'all', label: DUE_MESSAGES.FILTER_SCOPE_ALL },
        ].map((f) => (
          <Pressable
            key={f.key}
            style={[styles.filterChip, periodScope === f.key && styles.filterChipActive]}
            onPress={() => setPeriodScope(f.key)}
            role="button"
          >
            <Text style={[styles.filterChipText, periodScope === f.key && styles.filterChipTextActive]}>{f.label}</Text>
          </Pressable>
        ))}
      </View>

      {periodScope !== 'all' ? (
        <View style={styles.periodNav}>
          <Pressable onPress={periodScope === 'month' ? goPrevMonth : goPrevYear} style={styles.periodNavBtn} hitSlop={10}>
            <Ionicons name="chevron-back" size={20} color={COLORS.text} />
          </Pressable>
          <Text style={styles.periodNavLabel}>
            {periodScope === 'month' ? `${getMonthName(month)} ${year}` : `${DUE_MESSAGES.FILTER_SCOPE_YEAR} ${year}`}
          </Text>
          <Pressable onPress={periodScope === 'month' ? goNextMonth : goNextYear} style={styles.periodNavBtn} hitSlop={10}>
            <Ionicons name="chevron-forward" size={20} color={COLORS.text} />
          </Pressable>
        </View>
      ) : (
        <Text style={styles.allTimeLabel}>{DUE_MESSAGES.FILTER_SCOPE_ALL}</Text>
      )}

      <View style={styles.summaryCard}>
        <View style={styles.summaryIcon}>
          <Ionicons name="receipt-outline" size={26} color={COLORS.warning} />
        </View>
        <View style={styles.summaryTextCol}>
          <View style={styles.summaryLine}>
            <Text style={styles.summaryLabel}>{DUE_MESSAGES.SUMMARY_TOTAL_DUE_PRINCIPAL}</Text>
            <Text style={styles.summaryAmount}>Rs. {formatAmount(dueSummaryTotals.totalPrincipal)}</Text>
          </View>
          <View style={styles.summaryLine}>
            <Text style={styles.summaryLabel}>{DUE_MESSAGES.SUMMARY_REMAINING_DUE}</Text>
            <Text style={[styles.summaryAmount, styles.summaryRemaining]}>
              Rs. {formatAmount(dueSummaryTotals.totalRemaining)}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tabBtn, activeTab === 'all' && styles.tabBtnActive]}
          onPress={() => setActiveTab('all')}
          role="button"
        >
          <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>All Entries</Text>
        </Pressable>
        <Pressable
          style={[styles.tabBtn, activeTab === 'accounts' && styles.tabBtnActive]}
          onPress={() => setActiveTab('accounts')}
          role="button"
        >
          <Text style={[styles.tabText, activeTab === 'accounts' && styles.tabTextActive]}>Accounts</Text>
        </Pressable>
      </View>
    </View>
  );

  const ListEmpty = () => {
    const filtered = periodScope !== 'all';
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="receipt-outline" size={60} color={COLORS.textLight} />
        <Text style={styles.emptyTitle}>{filtered ? DUE_MESSAGES.EMPTY_FILTER_TITLE : DUE_MESSAGES.EMPTY_TITLE}</Text>
        <Text style={styles.emptyText}>{filtered ? DUE_MESSAGES.EMPTY_FILTER_SUBTITLE : DUE_MESSAGES.EMPTY_SUBTITLE}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={activeTab === 'all' ? groupedEntries : accountTotals}
        renderItem={activeTab === 'all' ? renderAllEntriesGroup : renderAccountRow}
        keyExtractor={(item) => String(activeTab === 'all' ? item.key : item.person_id)}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.warning]}
            tintColor={COLORS.warning}
          />
        }
      />
      <Pressable
        style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85 }]}
        onPress={() => navigation.navigate('AddDue')}
        role="button"
      >
        <Ionicons name="add" size={24} color={COLORS.textWhite} />
      </Pressable>

      <DueAmountEditModal
        visible={Boolean(amountEditGroup)}
        onClose={() => setAmountEditGroup(null)}
        userId={user?.id}
        group={amountEditGroup}
        onSaved={loadData}
      />

      <DueRepayModal
        visible={Boolean(repayModalGroup)}
        onClose={() => setRepayModalGroup(null)}
        userId={user?.id}
        dueEntry={repayModalGroup?.due}
        remaining={repayModalStats?.remaining ?? 0}
        onSaved={loadData}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  listContent: { padding: 20, paddingTop: 8, paddingBottom: 90 },
  headerWrap: { marginBottom: 16 },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  filterChipActive: {
    backgroundColor: COLORS.warning + '18',
    borderColor: COLORS.warning + '55',
  },
  filterChipText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: FONTS.weights.medium,
  },
  filterChipTextActive: {
    color: COLORS.warning,
    fontWeight: FONTS.weights.semiBold,
  },
  periodNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 12,
  },
  periodNavBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  periodNavLabel: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.text,
    minWidth: 160,
    textAlign: 'center',
  },
  allTimeLabel: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 12,
  },
  tabRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    backgroundColor: COLORS.surface,
    paddingVertical: 10,
  },
  tabBtnActive: {
    borderColor: COLORS.warning,
    backgroundColor: COLORS.warning + '15',
  },
  tabText: {
    color: COLORS.textSecondary,
    fontWeight: FONTS.weights.semiBold,
    fontSize: FONTS.sizes.sm,
  },
  tabTextActive: {
    color: COLORS.warning,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  accountAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.warning + '26',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  accountAvatarText: {
    color: COLORS.warning,
    fontWeight: FONTS.weights.bold,
    fontSize: FONTS.sizes.base,
  },
  accountInfo: { flex: 1 },
  accountName: {
    color: COLORS.text,
    fontWeight: FONTS.weights.semiBold,
    fontSize: FONTS.sizes.base,
  },
  accountMeta: {
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.xs,
    marginTop: 2,
  },
  accountAmount: {
    fontWeight: FONTS.weights.bold,
    fontSize: FONTS.sizes.md,
  },
  accountArrow: {
    marginLeft: 8,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.warning + '14',
    borderRadius: 16,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.warning + '25',
  },
  summaryTextCol: {
    flex: 1,
    gap: 10,
  },
  summaryLine: {
    gap: 2,
  },
  summaryRemaining: {
    color: COLORS.expense,
  },
  summaryIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: COLORS.warning + '26',
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryLabel: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginBottom: 2 },
  summaryAmount: { fontSize: FONTS.sizes.xl, fontWeight: FONTS.weights.bold, color: COLORS.warning },
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
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 22,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: COLORS.warning,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default DueAmountScreen;
