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
import { COLORS } from '../../constants/colors';
import { FONTS } from '../../constants/fonts';
import { getPersonEntries } from '../../services/personService';
import { deleteEntry } from '../../services/entryService';
import { formatAmount } from '../../utils/currencyUtils';
import { getMonthName, formatTime12h } from '../../utils/dateUtils';
import { showAlert, showConfirm } from '../../utils/alertUtils';
import { ACCOUNT_MESSAGES } from '../../messages/accountMessages';
import { COMMON_MESSAGES } from '../../messages/commonMessages';
import { exportSummaryReportPdf } from '../../services/pdfReportService';

const INVEST_COLOR = '#7C4DFF';
const formatSignedRupee = (value) => `${value >= 0 ? '+' : '-'} Rs. ${formatAmount(Math.abs(value || 0))}`;

const AccountSummaryScreen = ({ route, navigation }) => {
  const { person } = route.params;
  const [entries, setEntries] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const loadEntries = useCallback(async () => {
    const result = await getPersonEntries(person.id);
    if (result.success) {
      setEntries(result.data);
    } else {
      showAlert('Error', ACCOUNT_MESSAGES.REFRESH_FAILED);
    }
  }, [person.id]);

  useFocusEffect(
    useCallback(() => {
      loadEntries();
    }, [loadEntries])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const result = await getPersonEntries(person.id);
      if (result.success) {
        setEntries(result.data);
        showAlert('Success', ACCOUNT_MESSAGES.REFRESH_SUCCESS);
      } else {
        showAlert('Error', ACCOUNT_MESSAGES.REFRESH_FAILED);
      }
    } catch {
      showAlert('Error', ACCOUNT_MESSAGES.REFRESH_FAILED);
    } finally {
      setRefreshing(false);
    }
  };

  const totalInvested = entries.reduce(
    (sum, e) => sum + ((e.type === 'earning' ? 1 : -1) * (e.amount || 0)),
    0
  );

  const handleDelete = (entry) => {
    showConfirm(
      'Delete Entry',
      `Remove this entry of Rs. ${formatAmount(entry.amount)}?`,
      async () => {
        const result = await deleteEntry(entry.id);
        if (result.success) {
          showAlert('Success', result.message || COMMON_MESSAGES.DELETE_SUCCESS);
          loadEntries();
        } else {
          showAlert('Error', result.message || COMMON_MESSAGES.DELETE_FAILED);
        }
      }
    );
  };

  const formatEntryDate = (dateStr) => {
    const d = new Date(dateStr);
    return `${String(d.getDate()).padStart(2, '0')} ${getMonthName(d.getMonth() + 1)} ${d.getFullYear()}`;
  };

  const handleExportPdf = async () => {
    try {
      setExportingPdf(true);
      const result = await exportSummaryReportPdf({
        title: `${person.name} - Account Report`,
        subtitle: 'Individual investment account summary',
        metaLines: [
          `Total entries: ${entries.length}`,
        ],
        totals: [
          { label: 'Total Invested', value: formatSignedRupee(totalInvested) },
        ],
        rows: entries.map((entry) => ({
          label: `${entry.title} (${formatEntryDate(entry.date)})`,
          value: `${entry.type === 'earning' ? '+' : '-'} Rs. ${formatAmount(entry.amount || 0)}`,
        })),
        fileName: `account-${person.name}-${Date.now()}`,
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

  const renderEntry = ({ item }) => {
    const dateLabel = formatEntryDate(item.date);
    const timeLabel = formatTime12h(item.date);
    const hasInvoice = !!item.invoice_uri;
    const isEarning = item.type === 'earning';
    const signedAmount = `${isEarning ? '+' : '-'} Rs. ${formatAmount(item.amount)}`;

    return (
      <Pressable
        style={({ pressed }) => [styles.entryRow, pressed && styles.entryRowPressed]}
        onPress={() => navigation.navigate('EntryDetail', { entry: { ...item, person_name: person.name } })}
        role="button"
      >
        <View style={styles.entryIcon}>
          <Ionicons
            name={isEarning ? 'arrow-down-circle' : 'arrow-up-circle'}
            size={20}
            color={isEarning ? COLORS.income : COLORS.expense}
          />
        </View>
        <View style={styles.entryInfo}>
          <Text style={styles.entryTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.entryDate}>{dateLabel} · {timeLabel}</Text>
          {hasInvoice && (
            <View style={styles.invoiceTag}>
              <Ionicons name="attach" size={12} color={COLORS.textSecondary} />
              <Text style={styles.invoiceTagText}>Invoice</Text>
            </View>
          )}
        </View>
        <View style={styles.entryRight}>
          <Text style={[
            styles.entryAmount,
            { color: isEarning ? COLORS.income : COLORS.expense },
          ]}>{signedAmount}</Text>
          <Pressable
            style={({ pressed }) => [styles.entryDeleteBtn, pressed && { opacity: 0.5 }]}
            onPress={(e) => { e.stopPropagation(); handleDelete(item); }}
            role="button"
            hitSlop={8}
          >
            <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
          </Pressable>
        </View>
      </Pressable>
    );
  };

  const initial = person.name.charAt(0).toUpperCase();

  return (
    <View style={styles.container}>
      {/* Person Header Card */}
      <View style={styles.headerCard}>
        <View style={styles.headerAvatar}>
          <Text style={styles.headerAvatarText}>{initial}</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{person.name}</Text>
          <Text style={styles.headerMeta}>
            {entries.length} {entries.length === 1 ? 'investment' : 'investments'}
          </Text>
        </View>
      </View>

      {/* Total Amount Card */}
      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Total Invested</Text>
        <Text style={[
          styles.totalAmount,
          { color: totalInvested >= 0 ? COLORS.income : COLORS.expense },
        ]}>{formatSignedRupee(totalInvested)}</Text>
      </View>

      {/* Entries List */}
      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>Investment History</Text>
        <Pressable
          style={({ pressed }) => [styles.exportBtn, pressed && { opacity: 0.7 }, exportingPdf && { opacity: 0.5 }]}
          onPress={handleExportPdf}
          role="button"
          disabled={exportingPdf}
        >
          <Ionicons name="document-text-outline" size={15} color={INVEST_COLOR} />
          <Text style={styles.exportBtnText}>{exportingPdf ? 'Exporting...' : 'Export PDF'}</Text>
        </Pressable>
      </View>

      <FlatList
        data={entries}
        renderItem={renderEntry}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={INVEST_COLOR}
            colors={[INVEST_COLOR]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={50} color={COLORS.textLight} />
            <Text style={styles.emptyTitle}>No investments yet</Text>
            <Text style={styles.emptyText}>Investments linked to {person.name} will appear here</Text>
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
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: INVEST_COLOR,
    padding: 20,
    paddingTop: 16,
    paddingBottom: 20,
    gap: 16,
  },
  headerAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatarText: {
    fontSize: 24,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textWhite,
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textWhite,
  },
  headerMeta: {
    fontSize: FONTS.sizes.sm,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },
  totalCard: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 20,
    marginTop: -1,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    transform: [{ translateY: -12 }],
  },
  totalLabel: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  totalAmount: {
    fontSize: 30,
    fontWeight: FONTS.weights.extraBold,
    color: INVEST_COLOR,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  listTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.text,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: INVEST_COLOR + '14',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  exportBtnText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.semiBold,
    color: INVEST_COLOR,
  },
  listContent: {
    paddingHorizontal: 20,
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
  entryRowPressed: {
    backgroundColor: COLORS.borderLight,
  },
  entryIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: INVEST_COLOR + '12',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  entryInfo: {
    flex: 1,
  },
  entryTitle: {
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.text,
  },
  entryDate: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  invoiceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
  },
  invoiceTagText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
  },
  entryRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  entryAmount: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: INVEST_COLOR,
  },
  entryDeleteBtn: {
    padding: 4,
    borderRadius: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.textSecondary,
    marginTop: 12,
  },
  emptyText: {
    fontSize: FONTS.sizes.md,
    color: COLORS.textLight,
    marginTop: 4,
    textAlign: 'center',
  },
});

export default AccountSummaryScreen;
