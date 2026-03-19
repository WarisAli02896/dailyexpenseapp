import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
  Switch,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Button, Dropdown, Input } from '../../components/common';
import { COLORS } from '../../constants/colors';
import { FONTS } from '../../constants/fonts';
import { getPersons } from '../../services/personService';
import { transferBetweenAccounts } from '../../services/entryService';
import { addOrUpdateTemplate } from '../../services/recurringService';
import { saveInvoice, getFileType, formatFileSize } from '../../services/fileService';
import { useAuth } from '../../hooks/useAuth';
import { formatDateForDB, getMonthName, formatTime12h } from '../../utils/dateUtils';
import { showAlert } from '../../utils/alertUtils';
import { TRANSFER_MESSAGES } from '../../../messages/transferMessages';
import { AttachmentPicker } from '../../components/common';

const TransferAmountScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [persons, setPersons] = useState([]);
  const [fromAccount, setFromAccount] = useState('');
  const [toAccount, setToAccount] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [invoice, setInvoice] = useState(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const loadData = async () => {
        if (!user) return;
        const personsResult = await getPersons(user.id);

        if (personsResult.success) {
          setPersons(personsResult.data);
          const active = personsResult.data.find((p) => p.is_active === 1);
          if (!fromAccount && active) setFromAccount(String(active.id));
        }
      };

      loadData();
    }, [user, fromAccount])
  );

  const accountOptions = useMemo(
    () => persons.map((person) => ({ value: String(person.id), label: person.name, icon: 'person-outline' })),
    [persons]
  );

  const now = new Date();
  const currentMonthName = getMonthName(now.getMonth() + 1);
  const currentYear = now.getFullYear();
  const dateStr = `${String(now.getDate()).padStart(2, '0')} ${currentMonthName} ${currentYear}`;
  const timeStr = formatTime12h(now.toISOString());

  const handleAmountChange = (text) => {
    const filtered = text.replace(/[^0-9.]/g, '');
    const parts = filtered.split('.');
    const sanitized = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : filtered;
    setAmount(sanitized);
    if (errors.amount) setErrors((prev) => ({ ...prev, amount: null }));
  };

  const validate = () => {
    const nextErrors = {};
    if (persons.length < 2) nextErrors.accounts = TRANSFER_MESSAGES.ACCOUNT_MISSING;
    if (!fromAccount) nextErrors.fromAccount = TRANSFER_MESSAGES.FROM_ACCOUNT_REQUIRED;
    if (!toAccount) nextErrors.toAccount = TRANSFER_MESSAGES.TO_ACCOUNT_REQUIRED;
    if (fromAccount && toAccount && fromAccount === toAccount) {
      nextErrors.toAccount = TRANSFER_MESSAGES.SAME_ACCOUNT_NOT_ALLOWED;
    }
    if (!amount.trim()) nextErrors.amount = TRANSFER_MESSAGES.AMOUNT_REQUIRED;
    else if (parseFloat(amount) <= 0) nextErrors.amount = TRANSFER_MESSAGES.AMOUNT_POSITIVE;

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      let invoiceUri = null;
      let invoiceType = null;
      if (invoice) {
        invoiceUri = await saveInvoice(invoice.uri, invoice.name);
        invoiceType = invoice.mimeType || null;
      }

      const result = await transferBetweenAccounts({
        userId: user.id,
        fromPersonId: parseInt(fromAccount, 10),
        toPersonId: parseInt(toAccount, 10),
        amount: parseFloat(amount),
        note: notes.trim() || null,
        date: formatDateForDB(new Date()),
        invoiceUri,
        invoiceType,
      });

      if (result.success) {
        if (isRecurring) {
          const fromPerson = persons.find((p) => String(p.id) === fromAccount);
          const toPerson = persons.find((p) => String(p.id) === toAccount);
          const transferAmount = parseFloat(amount);

          await Promise.all([
            addOrUpdateTemplate({
              userId: user.id,
              type: 'spending',
              entryType: 'transfer',
              title: `Transfer to ${toPerson?.name || 'Account'}`,
              amount: transferAmount,
              personId: parseInt(fromAccount, 10),
            }),
            addOrUpdateTemplate({
              userId: user.id,
              type: 'earning',
              entryType: 'transfer',
              title: `Transfer from ${fromPerson?.name || 'Account'}`,
              amount: transferAmount,
              personId: parseInt(toAccount, 10),
            }),
          ]);
        }

        showAlert('Success', TRANSFER_MESSAGES.ADD_SUCCESS);
        navigation.goBack();
      } else {
        showAlert('Error', result.message || TRANSFER_MESSAGES.ADD_FAILED);
      }
    } catch (error) {
      showAlert('Error', TRANSFER_MESSAGES.ADD_FAILED);
    } finally {
      setLoading(false);
    }
  };

  const fileType = invoice ? getFileType(invoice.mimeType) : null;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.monthBanner}>
          <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
          <Text style={styles.monthBannerText}>{currentMonthName} {currentYear}</Text>
        </View>

        <View style={styles.badge}>
          <Ionicons name="swap-horizontal-outline" size={20} color={COLORS.primary} />
          <Text style={styles.badgeText}>Transfer Between Accounts</Text>
        </View>

        <View style={styles.dateTimeCard}>
          <View style={styles.dateTimeItem}>
            <Ionicons name="calendar" size={16} color={COLORS.primary} />
            <Text style={styles.dateTimeText}>{dateStr}</Text>
          </View>
          <View style={styles.dateTimeDivider} />
          <View style={styles.dateTimeItem}>
            <Ionicons name="time" size={16} color={COLORS.primary} />
            <Text style={styles.dateTimeText}>{timeStr}</Text>
          </View>
        </View>

        {errors.accounts ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={16} color={COLORS.danger} />
            <Text style={styles.errorCardText}>{errors.accounts}</Text>
          </View>
        ) : null}

        <Dropdown
          label="From Account"
          value={fromAccount}
          options={accountOptions}
          onSelect={(value) => {
            setFromAccount(value);
            if (errors.fromAccount) setErrors((prev) => ({ ...prev, fromAccount: null }));
          }}
          placeholder="Select source account"
          error={errors.fromAccount}
        />

        <Dropdown
          label="To Account"
          value={toAccount}
          options={accountOptions}
          onSelect={(value) => {
            setToAccount(value);
            if (errors.toAccount) setErrors((prev) => ({ ...prev, toAccount: null }));
          }}
          placeholder="Select destination account"
          error={errors.toAccount}
        />

        <View style={styles.amountContainer}>
          <Text style={styles.inputLabel}>Amount</Text>
          <View style={styles.amountRow}>
            <View style={styles.currencyTag}>
              <Text style={styles.currencyText}>Rs.</Text>
            </View>
            <View style={styles.amountInputWrap}>
              <Input
                value={amount}
                onChangeText={handleAmountChange}
                placeholder="0.00"
                keyboardType="numeric"
                error={errors.amount}
                style={styles.amountInput}
              />
            </View>
          </View>
        </View>

        <Input
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          placeholder="Optional transfer notes"
          multiline
          numberOfLines={3}
          style={styles.notesInput}
        />

        <View style={styles.invoiceSection}>
          <Text style={styles.inputLabel}>Attachment (Optional)</Text>
          {!invoice ? (
            <Pressable
              style={({ pressed }) => [styles.attachBtn, pressed && { opacity: 0.8 }]}
              onPress={() => setPickerVisible(true)}
              role="button"
            >
              <Ionicons name="attach-outline" size={20} color={COLORS.primary} />
              <Text style={styles.attachBtnText}>Add Attachment</Text>
            </Pressable>
          ) : (
            <View style={styles.invoicePreview}>
              <View style={styles.invoicePreviewLeft}>
                {fileType === 'image' ? (
                  <Image source={{ uri: invoice.uri }} style={styles.invoiceThumbnail} />
                ) : (
                  <View style={styles.invoiceIcon}>
                    <Ionicons name="document-outline" size={22} color={COLORS.textWhite} />
                  </View>
                )}
                <View style={styles.invoiceInfo}>
                  <Text style={styles.invoiceName} numberOfLines={1}>{invoice.name}</Text>
                  <Text style={styles.invoiceMeta}>{formatFileSize(invoice.size)}</Text>
                </View>
              </View>
              <Pressable onPress={() => setInvoice(null)} role="button" hitSlop={8}>
                <Ionicons name="close-circle" size={22} color={COLORS.danger} />
              </Pressable>
            </View>
          )}
        </View>

        <View style={styles.recurringCard}>
          <View style={styles.recurringLeft}>
            <View style={styles.recurringIcon}>
              <Ionicons name="repeat" size={22} color={COLORS.primary} />
            </View>
            <View>
              <Text style={styles.recurringTitle}>Monthly Recurring</Text>
              <Text style={styles.recurringDesc}>Repeat this transfer every month</Text>
            </View>
          </View>
          <Switch
            value={isRecurring}
            onValueChange={setIsRecurring}
            trackColor={{ false: COLORS.border, true: COLORS.primaryLight }}
            thumbColor={isRecurring ? COLORS.primary : COLORS.textLight}
          />
        </View>

        <Button
          title="Transfer Amount"
          onPress={handleSubmit}
          loading={loading}
          style={styles.submitBtn}
        />
      </ScrollView>

      <AttachmentPicker
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onFilePicked={(file) => setInvoice(file)}
        accentColor={COLORS.primary}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  monthBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '10',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.primary + '20',
  },
  monthBannerText: {
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.primary,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primary + '14',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    marginBottom: 16,
  },
  badgeText: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.primary,
  },
  dateTimeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  dateTimeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    justifyContent: 'center',
  },
  dateTimeDivider: {
    width: 1,
    height: 20,
    backgroundColor: COLORS.border,
    marginHorizontal: 8,
  },
  dateTimeText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.medium,
    color: COLORS.text,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: COLORS.danger + '12',
    borderWidth: 1,
    borderColor: COLORS.danger + '25',
    marginBottom: 16,
  },
  errorCardText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.danger,
    flex: 1,
  },
  inputLabel: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.medium,
    color: COLORS.text,
    marginBottom: 6,
  },
  amountContainer: {
    marginBottom: 16,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  currencyTag: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderRadius: 12,
  },
  currencyText: {
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textWhite,
  },
  amountInputWrap: {
    flex: 1,
  },
  amountInput: {
    marginBottom: 0,
  },
  notesInput: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  invoiceSection: { marginBottom: 10 },
  attachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
    backgroundColor: COLORS.surface,
    paddingVertical: 12,
  },
  attachBtnText: { color: COLORS.primary, fontWeight: FONTS.weights.semiBold, fontSize: FONTS.sizes.base },
  invoicePreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: 10,
  },
  invoicePreviewLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  invoiceThumbnail: { width: 44, height: 44, borderRadius: 8 },
  invoiceIcon: { width: 44, height: 44, borderRadius: 8, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  invoiceInfo: { flex: 1 },
  invoiceName: { color: COLORS.text, fontWeight: FONTS.weights.semiBold, fontSize: FONTS.sizes.sm },
  invoiceMeta: { color: COLORS.textSecondary, fontSize: FONTS.sizes.xs },
  recurringCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    marginTop: 10,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  recurringLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  recurringIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary + '14',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recurringTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.text,
    marginBottom: 2,
  },
  recurringDesc: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
    maxWidth: 180,
  },
  submitBtn: {
    marginTop: 20,
    backgroundColor: COLORS.primary,
  },
});

export default TransferAmountScreen;
