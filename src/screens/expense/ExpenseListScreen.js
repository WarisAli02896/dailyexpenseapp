import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import EntryRow from '../../components/expense/EntryRow';
import { COLORS } from '../../constants/colors';
import { FONTS } from '../../constants/fonts';
import { getMonthName, getShortMonthName, formatTime12h } from '../../utils/dateUtils';
import { formatAmount } from '../../utils/currencyUtils';
import { getEntriesByType, deleteEntry } from '../../services/entryService';
import { useAuth } from '../../hooks/useAuth';
import { showAlert, showConfirm } from '../../utils/alertUtils';
import { EXPENSE_MESSAGES } from '../../messages/expenseMessages';

const ExpenseListScreen = ({ navigation }) => {
  const { user } = useAuth();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    const result = await getEntriesByType(user.id, 'spending', month, year);
    if (result.success) {
      setEntries(result.data);
      setTotal(result.total);
    } else {
      showAlert('Error', EXPENSE_MESSAGES.FETCH_FAILED);
    }
  }, [user, month, year]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      const result = await getEntriesByType(user.id, 'spending', month, year);
      if (result.success) {
        setEntries(result.data);
        setTotal(result.total);
        showAlert('Success', EXPENSE_MESSAGES.REFRESH_SUCCESS);
      } else {
        showAlert('Error', EXPENSE_MESSAGES.REFRESH_FAILED);
      }
    } catch {
      showAlert('Error', EXPENSE_MESSAGES.REFRESH_FAILED);
    } finally {
      setRefreshing(false);
    }
  }, [user, month, year]);

  const goPrev = () => {
    if (month === 1) { setMonth(12); setYear(year - 1); }
    else setMonth(month - 1);
  };

  const goNext = () => {
    if (month === 12) { setMonth(1); setYear(year + 1); }
    else setMonth(month + 1);
  };

  const handleDelete = (entry) => {
    showConfirm('Delete Entry', `Delete "${entry.title}"?`, async () => {
      const result = await deleteEntry(entry.id);
      if (result.success) {
        showAlert('Success', result.message || EXPENSE_MESSAGES.DELETE_SUCCESS);
        loadData();
      } else {
        showAlert('Error', result.message || EXPENSE_MESSAGES.DELETE_FAILED);
      }
    });
  };

  const renderEntry = ({ item }) => {
    const displayDate = item.due_date || item.date;
    const day = new Date(displayDate);
    const datePart = `${String(day.getDate()).padStart(2, '0')} ${getShortMonthName(day.getMonth() + 1)}`;
    const timePart = formatTime12h(displayDate);
    const dateLabel = timePart ? `${datePart} · ${timePart}` : datePart;

    return (
      <EntryRow
        title={item.title}
        amount={formatAmount(item.amount)}
        type={item.type}
        category={item.entry_type}
        accountName={item.person_name}
        date={dateLabel}
        invoiceUri={item.invoice_uri}
        onPress={() => navigation.navigate('EntryDetail', { entry: item })}
        onDelete={() => handleDelete(item)}
      />
    );
  };

  const ListHeader = () => (
    <View>
      <View style={styles.monthNav}>
        <Pressable onPress={goPrev} style={styles.navBtn} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </Pressable>
        <Text style={styles.monthText}>{getMonthName(month)} {year}</Text>
        <Pressable
          onPress={goNext}
          style={styles.navBtn}
          hitSlop={10}
        >
          <Ionicons name="chevron-forward" size={22} color={COLORS.text} />
        </Pressable>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryIcon}>
          <Ionicons name="arrow-up-circle" size={28} color={COLORS.expense} />
        </View>
        <View>
          <Text style={styles.summaryLabel}>Total Spendings</Text>
          <Text style={styles.summaryAmount}>Rs. {formatAmount(total)}</Text>
        </View>
        <Text style={styles.summaryCount}>{entries.length} Entries</Text>
      </View>
    </View>
  );

  const ListEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="wallet-outline" size={60} color={COLORS.textLight} />
      <Text style={styles.emptyTitle}>No expenses this month</Text>
      <Text style={styles.emptyText}>Add an expense or investment to see it here</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={entries}
        renderItem={renderEntry}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.expense]} tintColor={COLORS.expense} />
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  listContent: {
    padding: 20,
    paddingTop: 8,
    paddingBottom: 40,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  navBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  monthText: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.text,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.expense + '12',
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: COLORS.expense + '25',
  },
  summaryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.expense + '1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  summaryAmount: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.expense,
  },
  summaryCount: {
    marginLeft: 'auto',
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    overflow: 'hidden',
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
  },
});

export default ExpenseListScreen;
