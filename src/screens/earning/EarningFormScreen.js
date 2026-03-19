import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Input, AttachmentPicker } from '../../components/common';
import { COLORS } from '../../constants/colors';
import { FONTS } from '../../constants/fonts';
import { addEntry } from '../../services/entryService';
import { addOrUpdateTemplate } from '../../services/recurringService';
import { saveInvoice, formatFileSize, getFileType } from '../../services/fileService';
import { getActivePerson } from '../../services/personService';
import { useAuth } from '../../hooks/useAuth';
import { formatDateForDB, getMonthName, formatTime12h } from '../../utils/dateUtils';
import { showAlert } from '../../utils/alertUtils';
import { EARNING_MESSAGES } from '../../messages/earningMessages';

const EarningFormScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [isSalary, setIsSalary] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [invoice, setInvoice] = useState(null);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);

  const now = new Date();
  const currentMonthName = getMonthName(now.getMonth() + 1);
  const currentYear = now.getFullYear();
  const dateStr = `${String(now.getDate()).padStart(2, '0')} ${currentMonthName} ${currentYear}`;
  const timeStr = formatTime12h(now.toISOString());
  const savedEntryType = isSalary ? 'salary' : 'earning';

  const handleAmountChange = (text) => {
    const filtered = text.replace(/[^0-9.]/g, '');
    const parts = filtered.split('.');
    const sanitized = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : filtered;
    setAmount(sanitized);
    if (errors.amount) setErrors((prev) => ({ ...prev, amount: null }));
  };

  const handleRemoveInvoice = () => {
    setInvoice(null);
  };

  const validate = () => {
    const newErrors = {};
    if (!title.trim()) newErrors.title = EARNING_MESSAGES.TITLE_REQUIRED;
    if (!amount.trim()) newErrors.amount = EARNING_MESSAGES.AMOUNT_REQUIRED;
    else if (parseFloat(amount) <= 0) newErrors.amount = EARNING_MESSAGES.AMOUNT_POSITIVE;
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const buildEntryTitle = () => (isSalary ? `Salary - ${title.trim()}` : title.trim());

  const handleSubmit = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      const activePersonResult = await getActivePerson(user.id);
      const activePerson = activePersonResult.success ? activePersonResult.data : null;
      if (!activePerson) {
        showAlert('Account Required', EARNING_MESSAGES.ACTIVE_ACCOUNT_REQUIRED);
        setLoading(false);
        return;
      }

      let invoiceUri = null;
      let invoiceType = null;
      if (invoice) {
        invoiceUri = await saveInvoice(invoice.uri, invoice.name);
        invoiceType = invoice.mimeType || null;
      }

      const entryTitle = buildEntryTitle();

      const result = await addEntry({
        userId: user.id,
        type: 'earning',
        entryType: savedEntryType,
        title: entryTitle,
        amount: parseFloat(amount),
        companyName: isSalary ? title.trim() : null,
        notes: notes.trim() || null,
        date: formatDateForDB(new Date()),
        personId: activePerson.id,
        showInAccount: true,
        isRecurring,
        invoiceUri,
        invoiceType,
      });

      if (result.success) {
        if (isRecurring) {
          await addOrUpdateTemplate({
            userId: user.id,
            type: 'earning',
            entryType: savedEntryType,
            title: entryTitle,
            amount: parseFloat(amount),
            companyName: isSalary ? title.trim() : null,
            personId: activePerson.id,
          });
        }
        showAlert('Success', isSalary ? EARNING_MESSAGES.SALARY_ADD_SUCCESS : EARNING_MESSAGES.ADD_SUCCESS);
        navigation.goBack();
      } else {
        showAlert('Error', result.message || EARNING_MESSAGES.ADD_FAILED);
      }
    } catch (error) {
      showAlert('Error', EARNING_MESSAGES.ADD_FAILED);
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
        {/* Month Banner */}
        <View style={styles.monthBanner}>
          <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
          <Text style={styles.monthText}>{currentMonthName} {currentYear}</Text>
        </View>

        {/* Header Badge */}
        <View style={styles.badge}>
          <Ionicons name="wallet-outline" size={20} color={COLORS.income} />
          <Text style={styles.badgeText}>Add Earning</Text>
        </View>

        {/* Date/Time Info */}
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

        {/* Form */}
        <View style={styles.form}>
          {/* Salary Check */}
          <View style={styles.salaryCheckCard}>
            <View style={styles.salaryCheckLeft}>
              <View style={styles.salaryCheckIcon}>
                <Ionicons name="cash-outline" size={20} color={COLORS.income} />
              </View>
              <View>
                <Text style={styles.salaryCheckTitle}>Is this salary?</Text>
                <Text style={styles.salaryCheckDesc}>
                  {isSalary ? 'This will be saved as salary entry' : 'This will be saved as normal earning'}
                </Text>
              </View>
            </View>
            <Switch
              value={isSalary}
              onValueChange={(val) => {
                setIsSalary(val);
                if (!val) setIsRecurring(false);
              }}
              trackColor={{ false: COLORS.border, true: COLORS.income + '80' }}
              thumbColor={isSalary ? COLORS.income : COLORS.textLight}
            />
          </View>

          {/* Earning Detail */}
          <Input
            label={isSalary ? 'Company Name' : 'Earning Detail'}
            value={title}
            onChangeText={(text) => {
              setTitle(text);
              if (errors.title) setErrors((prev) => ({ ...prev, title: null }));
            }}
            placeholder={isSalary ? 'Enter company name' : 'e.g. Freelance, Bonus, Commission'}
            error={errors.title}
          />

          {/* Amount */}
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

          {/* Notes */}
          <View style={styles.notesSection}>
            <View style={styles.labelRow}>
              <Text style={styles.inputLabel}>Notes</Text>
              <Text style={styles.optionalTag}>Optional</Text>
            </View>
            <Input
              value={notes}
              onChangeText={setNotes}
              placeholder="Any additional details..."
              multiline
              numberOfLines={3}
              style={styles.notesInput}
            />
          </View>

          {/* Invoice Attachment */}
          <View style={styles.invoiceSection}>
            <View style={styles.labelRow}>
              <Text style={styles.inputLabel}>Invoice / Receipt</Text>
              <Text style={styles.optionalTag}>Optional</Text>
            </View>
            {!invoice ? (
              <Pressable
                style={({ pressed }) => [styles.invoicePickerBtn, pressed && styles.invoicePickerBtnPressed]}
                onPress={() => setPickerVisible(true)}
                role="button"
              >
                <View style={styles.invoicePickerContent}>
                  <View style={styles.invoiceIconCircle}>
                    <Ionicons name="camera-outline" size={28} color={COLORS.primary} />
                  </View>
                  <Text style={styles.invoicePickerTitle}>Tap to attach</Text>
                  <Text style={styles.invoicePickerHint}>Camera, gallery, or document</Text>
                </View>
              </Pressable>
            ) : (
              <View style={styles.invoicePreview}>
                <View style={styles.invoicePreviewLeft}>
                  {fileType === 'image' ? (
                    <Image source={{ uri: invoice.uri }} style={styles.invoiceThumbnail} />
                  ) : (
                    <View style={[styles.invoiceFileIcon, fileType === 'pdf' ? styles.pdfBg : styles.docBg]}>
                      <Ionicons
                        name={fileType === 'pdf' ? 'document-text' : 'document'}
                        size={24}
                        color={COLORS.textWhite}
                      />
                    </View>
                  )}
                  <View style={styles.invoiceInfo}>
                    <Text style={styles.invoiceFileName} numberOfLines={1}>{invoice.name}</Text>
                    <Text style={styles.invoiceFileSize}>
                      {formatFileSize(invoice.size)} {fileType === 'pdf' ? '· PDF' : fileType === 'doc' ? '· DOC' : '· Image'}
                    </Text>
                  </View>
                </View>
                <Pressable
                  style={({ pressed }) => [styles.removeInvoiceBtn, pressed && { opacity: 0.6 }]}
                  onPress={handleRemoveInvoice}
                  role="button"
                  hitSlop={8}
                >
                  <Ionicons name="close-circle" size={24} color={COLORS.danger} />
                </Pressable>
              </View>
            )}
          </View>

          {/* Recurring Toggle - only for salary */}
          {isSalary && (
            <>
              <View style={styles.recurringCard}>
                <View style={styles.recurringLeft}>
                  <View style={styles.recurringIcon}>
                    <Ionicons name="repeat" size={22} color={COLORS.income} />
                  </View>
                  <View>
                    <Text style={styles.recurringTitle}>Monthly Recurring</Text>
                    <Text style={styles.recurringDesc}>Add this amount every month automatically</Text>
                  </View>
                </View>
                <Switch
                  value={isRecurring}
                  onValueChange={setIsRecurring}
                  trackColor={{ false: COLORS.border, true: COLORS.income + '80' }}
                  thumbColor={isRecurring ? COLORS.income : COLORS.textLight}
                />
              </View>

              {isRecurring && (
                <View style={styles.recurringNote}>
                  <Ionicons name="information-circle-outline" size={16} color={COLORS.info} />
                  <Text style={styles.recurringNoteText}>
                    This amount will be automatically added at the start of each month
                  </Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* Submit */}
        <Button
          title={`Add ${isSalary ? 'Salary' : 'Earning'} Entry`}
          onPress={handleSubmit}
          loading={loading}
          style={styles.submitBtn}
        />
      </ScrollView>

      <AttachmentPicker
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onFilePicked={(file) => setInvoice(file)}
        accentColor={COLORS.income}
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
  monthText: {
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.primary,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: COLORS.income + '14',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    marginBottom: 16,
  },
  badgeText: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.income,
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
  form: {
    gap: 0,
  },
  salaryCheckCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  salaryCheckLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  salaryCheckIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.income + '14',
    justifyContent: 'center',
    alignItems: 'center',
  },
  salaryCheckTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.text,
  },
  salaryCheckDesc: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: COLORS.income + '12',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
    marginBottom: 16,
    marginTop: -8,
  },
  typeChipText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.income,
  },
  inputLabel: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.medium,
    color: COLORS.text,
    marginBottom: 6,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  optionalTag: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textLight,
    fontStyle: 'italic',
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
    backgroundColor: COLORS.income,
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderRadius: 12,
    marginTop: 0,
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
  notesSection: {
    marginBottom: 16,
  },
  notesInput: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  invoiceSection: {
    marginBottom: 16,
  },
  invoicePickerBtn: {
    borderWidth: 2,
    borderColor: COLORS.income + '30',
    borderStyle: 'dashed',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
  },
  invoicePickerBtnPressed: {
    backgroundColor: COLORS.income + '08',
  },
  invoicePickerContent: {
    alignItems: 'center',
    gap: 6,
  },
  invoiceIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.income + '12',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  invoicePickerTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.text,
  },
  invoicePickerHint: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  invoicePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  invoicePreviewLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  invoiceThumbnail: {
    width: 50,
    height: 50,
    borderRadius: 10,
    backgroundColor: COLORS.borderLight,
  },
  invoiceFileIcon: {
    width: 50,
    height: 50,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pdfBg: {
    backgroundColor: '#E53935',
  },
  docBg: {
    backgroundColor: '#1565C0',
  },
  invoiceInfo: {
    flex: 1,
  },
  invoiceFileName: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.text,
    marginBottom: 2,
  },
  invoiceFileSize: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
  },
  removeInvoiceBtn: {
    padding: 4,
  },
  recurringCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    marginTop: 8,
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
    backgroundColor: COLORS.income + '14',
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
  recurringNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.info + '10',
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
    gap: 8,
  },
  recurringNoteText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.info,
    flex: 1,
  },
  submitBtn: {
    marginTop: 32,
    backgroundColor: COLORS.income,
  },
});

export default EarningFormScreen;
