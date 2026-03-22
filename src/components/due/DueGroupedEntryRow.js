import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { FONTS } from '../../constants/fonts';
import { formatAmount } from '../../utils/currencyUtils';
import { DUE_MESSAGES } from '../../messages/dueMessages';

const formatDayMonth = (value) => {
  if (!value) return '-';
  const d = new Date(value);
  const day = String(d.getDate()).padStart(2, '0');
  const month = d.toLocaleString('en-US', { month: 'short' });
  return `${day} ${month}`;
};

const DueGroupedEntryRow = ({
  due,
  latestRepayment,
  totalReturned,
  remainingDue,
  showRepayButton,
  onPress,
  onDelete,
  onRepay,
  onEditAmounts,
}) => {
  const isRepaid = !showRepayButton;

  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]} onPress={onPress} role="button">
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.title} numberOfLines={1}>{due.title}</Text>
          <Text style={styles.meta} numberOfLines={1}>
            To {due.person_name || '-'} · From {due.from_person_name || '-'} · Due ID #{due.id}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <View style={[styles.statusBadge, isRepaid ? styles.statusRepaid : styles.statusPending]}>
            <Text style={[styles.statusText, isRepaid ? styles.statusTextRepaid : styles.statusTextPending]}>
              {isRepaid ? 'Repaid' : 'Pending'}
            </Text>
          </View>
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            hitSlop={8}
            role="button"
            style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
          </Pressable>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.detailRow}>
        <View style={styles.rowLeft}>
          <Ionicons name="arrow-up-circle" size={18} color={COLORS.expense} />
          <Text style={styles.rowLabel}>Given</Text>
          <Text style={styles.rowDate}>Due {formatDayMonth(due.due_date || due.date)}</Text>
        </View>
        <View style={styles.amountRowRight}>
          <Text style={styles.givenAmount}>- Rs. {formatAmount(due.amount)}</Text>
          {onEditAmounts ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                onEditAmounts();
              }}
              hitSlop={8}
              style={({ pressed }) => [styles.editAmountBtn, pressed && { opacity: 0.7 }]}
              accessibilityRole="button"
              accessibilityLabel={DUE_MESSAGES.EDIT_AMOUNTS}
            >
              <Ionicons name="create-outline" size={18} color={COLORS.warning} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.detailRow}>
        <View style={styles.rowLeft}>
          <Ionicons name="arrow-down-circle" size={18} color={COLORS.income} />
          <Text style={styles.rowLabel}>{DUE_MESSAGES.REPAY_TOTAL_RETURNED_LABEL}</Text>
          <Text style={styles.rowDate}>
            {latestRepayment
              ? `Last: ${formatDayMonth(latestRepayment.date)} · Ref #${due.id}`
              : 'Not repaid yet'}
          </Text>
        </View>
        <Text style={styles.returnAmount}>
          {Number(totalReturned) > 0 ? `+ Rs. ${formatAmount(totalReturned)}` : '-'}
        </Text>
      </View>

      <View style={styles.detailRow}>
        <View style={styles.rowLeft}>
          <Ionicons name="hourglass-outline" size={18} color={COLORS.warning} />
          <Text style={styles.rowLabel}>{DUE_MESSAGES.REPAY_REMAINING_LABEL}</Text>
          <Text style={styles.rowDate}>{DUE_MESSAGES.REPAY_HISTORY_HINT}</Text>
        </View>
        <Text style={[styles.returnAmount, { color: COLORS.warning }]}>
          {Number(remainingDue) > 0 ? `Rs. ${formatAmount(remainingDue)}` : '—'}
        </Text>
      </View>

      {showRepayButton ? (
        <Pressable
          style={({ pressed }) => [styles.repayBtn, pressed && { opacity: 0.85 }]}
          onPress={(e) => {
            e.stopPropagation();
            onRepay();
          }}
          role="button"
        >
          <Ionicons name="cash-outline" size={16} color={COLORS.income} />
          <Text style={styles.repayText}>Repay</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: 14,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerLeft: { flex: 1 },
  title: {
    color: COLORS.text,
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.semiBold,
  },
  meta: {
    marginTop: 2,
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.xs,
  },
  headerRight: { alignItems: 'flex-end', gap: 8 },
  statusBadge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusPending: { backgroundColor: COLORS.warning + '1C' },
  statusRepaid: { backgroundColor: COLORS.primary + '1A' },
  statusText: { fontSize: FONTS.sizes.xs, fontWeight: FONTS.weights.semiBold },
  statusTextPending: { color: COLORS.warning },
  statusTextRepaid: { color: COLORS.primary },
  deleteBtn: { padding: 2 },
  divider: {
    height: 1,
    backgroundColor: COLORS.borderLight,
    marginVertical: 10,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  rowLabel: {
    color: COLORS.text,
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.medium,
  },
  rowDate: {
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.xs,
  },
  amountRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editAmountBtn: {
    padding: 4,
  },
  givenAmount: {
    color: COLORS.expense,
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
  },
  returnAmount: {
    color: COLORS.income,
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
  },
  repayBtn: {
    marginTop: 6,
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.income + '35',
    backgroundColor: COLORS.income + '12',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  repayText: {
    color: COLORS.income,
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.semiBold,
  },
});

export default DueGroupedEntryRow;
