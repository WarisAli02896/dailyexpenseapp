import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Pressable,
  Switch,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Button, Input, Dropdown, AttachmentPicker } from '../../components/common';
import { COLORS } from '../../constants/colors';
import { FONTS } from '../../constants/fonts';
import { EXPENSE_ENTRY_CATEGORIES } from '../../constants/categories';
import { addEntry } from '../../services/entryService';
import { addOrUpdateTemplate } from '../../services/recurringService';
import { getPersons, getActivePerson } from '../../services/personService';
import { saveInvoice, formatFileSize, getFileType } from '../../services/fileService';
import { useAuth } from '../../hooks/useAuth';
import { formatDateForDB, getMonthName, formatTime12h } from '../../utils/dateUtils';
import { showAlert } from '../../utils/alertUtils';
import { EXPENSE_MESSAGES } from '../../messages/expenseMessages';

const AddExpenseScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [expenseName, setExpenseName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('misc');
  const [amount, setAmount] = useState('');
  const [selectedPerson, setSelectedPerson] = useState('');
  const [activePersonName, setActivePersonName] = useState('');
  const [hasDueDate, setHasDueDate] = useState(false);
  const [dueDateInput, setDueDateInput] = useState('');
  const [dueDatePickerVisible, setDueDatePickerVisible] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [hasAccounts, setHasAccounts] = useState(false);
  const [invoice, setInvoice] = useState(null);
  const [isRecurring, setIsRecurring] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const loadPersons = async () => {
        if (!user) return;
        const [personsResult, activeResult] = await Promise.all([
          getPersons(user.id),
          getActivePerson(user.id),
        ]);

        if (personsResult.success) {
          setHasAccounts(personsResult.data.length > 0);
        }

        if (activeResult.success && activeResult.data) {
          setSelectedPerson(String(activeResult.data.id));
          setActivePersonName(activeResult.data.name);
        }

      };
      loadPersons();
    }, [user])
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

  const handleRemoveInvoice = () => {
    setInvoice(null);
  };

  const validate = () => {
    const newErrors = {};
    if (!expenseName.trim()) newErrors.expenseName = EXPENSE_MESSAGES.TITLE_REQUIRED;
    if (!selectedCategory) newErrors.category = 'Please select a category.';
    if (!amount.trim()) newErrors.amount = EXPENSE_MESSAGES.AMOUNT_REQUIRED;
    else if (parseFloat(amount) <= 0) newErrors.amount = EXPENSE_MESSAGES.AMOUNT_POSITIVE;
    if (hasDueDate) {
      const parsedDueDate = parseDueDateInput(dueDateInput);
      if (!dueDateInput.trim()) {
        newErrors.dueDate = EXPENSE_MESSAGES.DUE_DATE_REQUIRED;
      } else if (!parsedDueDate) {
        newErrors.dueDate = EXPENSE_MESSAGES.DUE_DATE_INVALID;
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const parseDueDateInput = (value) => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (!isoMatch) return null;
    const y = Number(isoMatch[1]);
    const m = Number(isoMatch[2]);
    const d = Number(isoMatch[3]);
    const candidate = new Date(y, m - 1, d, 12, 0, 0);
    if (
      Number.isNaN(candidate.getTime()) ||
      candidate.getFullYear() !== y ||
      candidate.getMonth() !== m - 1 ||
      candidate.getDate() !== d
    ) {
      return null;
    }
    return candidate;
  };

  const formatDueDateLabel = (value) => {
    const parsed = parseDueDateInput(value);
    if (!parsed) return 'Select due date';
    return `${String(parsed.getDate()).padStart(2, '0')} ${getMonthName(parsed.getMonth() + 1)} ${parsed.getFullYear()}`;
  };

  const formatDueDateKey = (dateObj) => {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const openDueDatePicker = () => {
    const selected = parseDueDateInput(dueDateInput);
    const anchor = selected || new Date();
    setCalendarMonth(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
    setDueDatePickerVisible(true);
  };

  const changeCalendarMonth = (offset) => {
    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  };

  const getCalendarCells = () => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];

    for (let i = 0; i < startOffset; i += 1) {
      cells.push(null);
    }
    for (let d = 1; d <= daysInMonth; d += 1) {
      cells.push(new Date(year, month, d));
    }
    while (cells.length % 7 !== 0) {
      cells.push(null);
    }
    return cells;
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

      const personId = selectedPerson ? parseInt(selectedPerson, 10) : null;
      const personLabel = activePersonName || '';
      const parsedDueDate = hasDueDate ? parseDueDateInput(dueDateInput) : null;

      const result = await addEntry({
        userId: user.id,
        type: 'spending',
        entryType: selectedCategory,
        title: expenseName.trim(),
        amount: parseFloat(amount),
        date: formatDateForDB(new Date()),
        dueDate: parsedDueDate ? formatDateForDB(parsedDueDate) : null,
        personId,
        isRecurring,
        showInAccount: !!personId,
        invoiceUri,
        invoiceType,
      });

      if (result.success) {
        if (isRecurring) {
          await addOrUpdateTemplate({
            userId: user.id,
            type: 'spending',
            entryType: selectedCategory,
            title: expenseName.trim(),
            amount: parseFloat(amount),
            companyName: personLabel || undefined,
            personId,
          });
        }
        showAlert('Success', EXPENSE_MESSAGES.ADD_SUCCESS);
        navigation.goBack();
      } else {
        showAlert('Error', result.message);
      }
    } catch (error) {
      showAlert('Error', EXPENSE_MESSAGES.ADD_FAILED);
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
          <Text style={styles.monthBannerText}>{currentMonthName} {currentYear}</Text>
        </View>

        {/* Header Badge */}
        <View style={styles.badge}>
          <Ionicons name="cart-outline" size={20} color={COLORS.expense} />
          <Text style={styles.badgeText}>Daily Expense</Text>
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
          <Input
            label="Expense Detail"
            value={expenseName}
            onChangeText={(text) => {
              setExpenseName(text);
              if (errors.expenseName) setErrors((prev) => ({ ...prev, expenseName: null }));
            }}
            placeholder="e.g. Lunch, Taxi, Groceries..."
            error={errors.expenseName}
          />

          <Dropdown
            label="Category"
            value={selectedCategory}
            options={EXPENSE_ENTRY_CATEGORIES}
            onSelect={(val) => {
              setSelectedCategory(val);
              if (errors.category) setErrors((prev) => ({ ...prev, category: null }));
            }}
            placeholder="Select expense category"
            error={errors.category}
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

          <View style={styles.dueDateCard}>
            <View style={styles.dueDateHeader}>
              <View style={styles.dueDateHeaderLeft}>
                <Ionicons name="calendar-clear-outline" size={18} color={COLORS.primary} />
                <View>
                  <Text style={styles.dueDateTitle}>Set Due Date</Text>
                  <Text style={styles.dueDateHint}>Expense will be counted in due-date month</Text>
                </View>
              </View>
              <Switch
                value={hasDueDate}
                onValueChange={(val) => {
                  setHasDueDate(val);
                  if (!val) {
                    setDueDateInput('');
                    if (errors.dueDate) setErrors((prev) => ({ ...prev, dueDate: null }));
                  }
                }}
                trackColor={{ false: COLORS.border, true: COLORS.primaryLight }}
                thumbColor={hasDueDate ? COLORS.primary : COLORS.textLight}
              />
            </View>
            {hasDueDate ? (
              <View style={styles.dueDatePickerWrap}>
                <Text style={styles.inputLabel}>Due Date</Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.dueDatePickerBtn,
                    errors.dueDate && styles.dueDatePickerBtnError,
                    pressed && { opacity: 0.85 },
                  ]}
                  onPress={openDueDatePicker}
                  role="button"
                >
                  <View style={styles.dueDatePickerBtnLeft}>
                    <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
                    <Text style={[
                      styles.dueDatePickerBtnText,
                      !parseDueDateInput(dueDateInput) && styles.dueDatePickerPlaceholder,
                    ]}>
                      {formatDueDateLabel(dueDateInput)}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
                </Pressable>
                {errors.dueDate ? <Text style={styles.accountErrorText}>{errors.dueDate}</Text> : null}
              </View>
            ) : null}
          </View>

          <View style={styles.dueDateCard}>
            <View style={styles.dueDateHeaderLeft}>
              <Ionicons name="person-circle-outline" size={18} color={COLORS.primary} />
              <View>
                <Text style={styles.dueDateTitle}>From Account</Text>
                <Text style={styles.dueDateHint}>This expense is linked to selected account</Text>
              </View>
            </View>
            <View style={styles.accountSection}>
              {selectedPerson ? (
                <View style={styles.activeAccountCard}>
                  <View style={styles.activeAccountLeft}>
                    <Ionicons name="checkmark-circle" size={18} color={COLORS.income} />
                    <Text style={styles.activeAccountText}>{activePersonName}</Text>
                  </View>
                  <Pressable onPress={() => navigation.navigate('AccountSelector')} hitSlop={8} role="button">
                    <Text style={styles.changeAccountText}>Change</Text>
                  </Pressable>
                </View>
              ) : null}
              {!hasAccounts ? (
                <View style={styles.accountHint}>
                  <Ionicons name="information-circle-outline" size={14} color={COLORS.primary} />
                  <Text style={styles.accountHintText}>Add an account first from Accounts tab.</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Picture Attachment (Optional) */}
          <View style={styles.invoiceSection}>
            <View style={styles.labelRow}>
              <Text style={styles.inputLabel}>Receipt / Picture</Text>
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
                  <Text style={styles.invoicePickerTitle}>Attach a picture</Text>
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
        </View>

        {/* Recurring Toggle */}
        <View style={styles.recurringCard}>
          <View style={styles.recurringLeft}>
            <View style={styles.recurringIcon}>
              <Ionicons name="repeat" size={22} color={COLORS.expense} />
            </View>
            <View>
              <Text style={styles.recurringTitle}>Monthly Recurring</Text>
              <Text style={styles.recurringDesc}>Repeat this expense every month</Text>
            </View>
          </View>
          <Switch
            value={isRecurring}
            onValueChange={setIsRecurring}
            trackColor={{ false: COLORS.border, true: COLORS.expense + '80' }}
            thumbColor={isRecurring ? COLORS.expense : COLORS.textLight}
          />
        </View>

        {isRecurring && (
          <View style={styles.recurringNote}>
            <Ionicons name="information-circle-outline" size={16} color={COLORS.expense} />
            <Text style={styles.recurringNoteText}>
              This amount will be automatically added at the start of each month
            </Text>
          </View>
        )}

        {/* Submit */}
        <Button
          title="Add Expense"
          onPress={handleSubmit}
          loading={loading}
          style={styles.submitBtn}
        />
      </ScrollView>

      <AttachmentPicker
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onFilePicked={(file) => setInvoice(file)}
        accentColor={COLORS.expense}
      />

      <Modal
        visible={dueDatePickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDueDatePickerVisible(false)}
      >
        <Pressable style={styles.calendarOverlay} onPress={() => setDueDatePickerVisible(false)}>
          <Pressable style={styles.calendarModal} onPress={() => {}}>
            <View style={styles.calendarHeader}>
              <Text style={styles.calendarTitle}>Select Due Date</Text>
              <Pressable onPress={() => setDueDatePickerVisible(false)} role="button" hitSlop={8}>
                <Ionicons name="close" size={22} color={COLORS.textSecondary} />
              </Pressable>
            </View>

            <View style={styles.calendarMonthRow}>
              <Pressable
                style={({ pressed }) => [styles.calendarNavBtn, pressed && { opacity: 0.75 }]}
                onPress={() => changeCalendarMonth(-1)}
                role="button"
              >
                <Ionicons name="chevron-back" size={18} color={COLORS.text} />
              </Pressable>
              <Text style={styles.calendarMonthLabel}>
                {getMonthName(calendarMonth.getMonth() + 1)} {calendarMonth.getFullYear()}
              </Text>
              <Pressable
                style={({ pressed }) => [styles.calendarNavBtn, pressed && { opacity: 0.75 }]}
                onPress={() => changeCalendarMonth(1)}
                role="button"
              >
                <Ionicons name="chevron-forward" size={18} color={COLORS.text} />
              </Pressable>
            </View>

            <View style={styles.weekRow}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <Text key={day} style={styles.weekDayLabel}>{day}</Text>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {getCalendarCells().map((dateObj, idx) => {
                if (!dateObj) {
                  return <View key={`empty-${idx}`} style={styles.calendarCell} />;
                }
                const iso = formatDueDateKey(dateObj);
                const isSelected = dueDateInput === iso;
                return (
                  <Pressable
                    key={iso}
                    style={({ pressed }) => [
                      styles.calendarCell,
                      isSelected && styles.calendarCellSelected,
                      pressed && { opacity: 0.8 },
                    ]}
                    onPress={() => {
                      setDueDateInput(iso);
                      if (errors.dueDate) setErrors((prev) => ({ ...prev, dueDate: null }));
                      setDueDatePickerVisible(false);
                    }}
                    role="button"
                  >
                    <Text style={[styles.calendarCellText, isSelected && styles.calendarCellTextSelected]}>
                      {dateObj.getDate()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
    backgroundColor: COLORS.expense + '14',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    marginBottom: 16,
  },
  badgeText: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.expense,
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
    backgroundColor: COLORS.expense,
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
  dueDateCard: {
    marginBottom: 16,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 12,
    padding: 12,
  },
  dueDateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dueDateHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  dueDateTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.text,
  },
  dueDateHint: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  dueDatePickerWrap: {
    marginTop: 6,
  },
  dueDatePickerBtn: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dueDatePickerBtnError: {
    borderColor: COLORS.danger,
  },
  dueDatePickerBtnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dueDatePickerBtnText: {
    fontSize: FONTS.sizes.base,
    color: COLORS.text,
    fontWeight: FONTS.weights.medium,
  },
  dueDatePickerPlaceholder: {
    color: COLORS.textLight,
    fontWeight: FONTS.weights.regular,
  },
  calendarOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    padding: 22,
  },
  calendarModal: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  calendarTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.text,
  },
  calendarMonthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  calendarNavBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarMonthLabel: {
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.text,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekDayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
    fontWeight: FONTS.weights.semiBold,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarCell: {
    width: '14.285%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  calendarCellSelected: {
    backgroundColor: COLORS.primary + '20',
  },
  calendarCellText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.text,
  },
  calendarCellTextSelected: {
    color: COLORS.primary,
    fontWeight: FONTS.weights.bold,
  },
  accountSection: {
    marginBottom: 16,
  },
  activeAccountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginTop: 6,
  },
  activeAccountLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activeAccountText: {
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.semiBold,
    color: COLORS.text,
  },
  changeAccountText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.primary,
    fontWeight: FONTS.weights.semiBold,
  },
  accountErrorText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.danger,
    marginTop: 4,
  },
  accountHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  accountHintText: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.primary,
  },
  invoiceSection: {
    marginBottom: 16,
  },
  invoicePickerBtn: {
    borderWidth: 2,
    borderColor: COLORS.primary + '30',
    borderStyle: 'dashed',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
  },
  invoicePickerBtnPressed: {
    backgroundColor: COLORS.primary + '08',
  },
  invoicePickerContent: {
    alignItems: 'center',
    gap: 6,
  },
  invoiceIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.primary + '12',
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
    marginTop: 16,
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
    backgroundColor: COLORS.expense + '14',
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
    backgroundColor: COLORS.expense + '10',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    gap: 8,
  },
  recurringNoteText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.expense,
    flex: 1,
  },
  submitBtn: {
    marginTop: 32,
    backgroundColor: COLORS.expense,
  },
});

export default AddExpenseScreen;
