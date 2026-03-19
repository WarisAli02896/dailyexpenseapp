import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { FONTS } from '../../constants/fonts';

const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

const EntryRow = ({ title, amount, type, category, date, accountName, invoiceUri, onPress, onDelete }) => {
  const isEarning = type === 'earning';

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={onPress}
      role="button"
    >
      <View style={[styles.typeIndicator, isEarning ? styles.earningIndicator : styles.spendingIndicator]} />

      <View style={styles.iconContainer}>
        <Ionicons
          name={isEarning ? 'arrow-down-circle' : 'arrow-up-circle'}
          size={28}
          color={isEarning ? COLORS.income : COLORS.expense}
        />
      </View>

      <View style={styles.details}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>
            {capitalize(category)}
            {accountName ? (
              <>
                <Text style={styles.meta}> · </Text>
                <Text style={styles.metaAccount}>{accountName}</Text>
              </>
            ) : null}
            {date ? <Text style={styles.meta}> · {date}</Text> : null}
          </Text>
          {invoiceUri ? (
            <View style={styles.invoiceTag}>
              <Ionicons name="attach" size={12} color={COLORS.primary} />
              <Text style={styles.invoiceTagText}>Invoice</Text>
            </View>
          ) : null}
        </View>
      </View>

      <Text style={[styles.amount, isEarning ? styles.earningAmount : styles.spendingAmount]}>
        {isEarning ? '+' : '-'} Rs. {amount}
      </Text>

      <Pressable
        style={({ pressed }) => [styles.deleteBtn, pressed && styles.deleteBtnPressed]}
        onPress={(e) => {
          e.stopPropagation();
          onDelete?.();
        }}
        role="button"
        aria-label={`Delete ${title}`}
        hitSlop={8}
      >
        <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
      </Pressable>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: {
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
  iconContainer: {
    marginLeft: 6,
    marginRight: 12,
  },
  details: {
    flex: 1,
    marginRight: 10,
  },
  title: {
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.text,
    marginBottom: 3,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  meta: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  metaAccount: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text,
    fontWeight: FONTS.weights.bold,
  },
  amount: {
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.bold,
    marginRight: 10,
  },
  earningAmount: {
    color: COLORS.income,
  },
  spendingAmount: {
    color: COLORS.expense,
  },
  deleteBtn: {
    padding: 6,
    borderRadius: 8,
  },
  deleteBtnPressed: {
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
  },
  rowPressed: {
    opacity: 0.85,
    backgroundColor: COLORS.borderLight,
  },
  invoiceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '12',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 3,
  },
  invoiceTagText: {
    fontSize: 10,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.primary,
  },
});

export default EntryRow;
