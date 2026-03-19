import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
  Modal,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Input, Dropdown, Button, AttachmentPicker } from '../../components/common';
import { COLORS } from '../../constants/colors';
import { FONTS } from '../../constants/fonts';
import { useAuth } from '../../hooks/useAuth';
import { addEntry } from '../../services/entryService';
import { getPersons, getActivePerson } from '../../services/personService';
import { saveInvoice, getFileType, formatFileSize } from '../../services/fileService';
import { formatDateForDB, getMonthName } from '../../utils/dateUtils';
import { showAlert } from '../../utils/alertUtils';
import { DUE_MESSAGES } from '../../messages/dueMessages';

const AddDueScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [fromPerson, setFromPerson] = useState('');
  const [toPerson, setToPerson] = useState('');
  const [personOptions, setPersonOptions] = useState([]);
  const [dueDateInput, setDueDateInput] = useState('');
  const [dueDatePickerVisible, setDueDatePickerVisible] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [invoice, setInvoice] = useState(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useFocusEffect(
    useCallback(() => {
      const loadPersons = async () => {
        if (!user) return;
        const [personsResult, activeResult] = await Promise.all([
          getPersons(user.id),
          getActivePerson(user.id),
        ]);

        if (personsResult.success) {
          const options = personsResult.data.map((p) => ({ value: String(p.id), label: p.name }));
          setPersonOptions(options);
        } else {
          setPersonOptions([]);
        }

        if (activeResult.success && activeResult.data) {
          setFromPerson(String(activeResult.data.id));
        }
      };

      loadPersons();
    }, [user])
  );

  const parseDueDateInput = (value) => {
    const trimmed = value.trim();
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (!match) return null;
    const y = Number(match[1]);
    const m = Number(match[2]);
    const d = Number(match[3]);
    const candidate = new Date(y, m - 1, d, 12, 0, 0);
    if (
      Number.isNaN(candidate.getTime()) ||
      candidate.getFullYear() !== y ||
      candidate.getMonth() !== m - 1 ||
      candidate.getDate() !== d
    ) return null;
    return candidate;
  };

  const formatDueDateKey = (dateObj) => {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const formatDueDateLabel = (value) => {
    const parsed = parseDueDateInput(value);
    if (!parsed) return 'Select due date';
    return `${String(parsed.getDate()).padStart(2, '0')} ${getMonthName(parsed.getMonth() + 1)} ${parsed.getFullYear()}`;
  };

  const getCalendarCells = () => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startOffset; i += 1) cells.push(null);
    for (let d = 1; d <= daysInMonth; d += 1) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  };

  const validate = () => {
    const nextErrors = {};
    if (!title.trim()) nextErrors.title = DUE_MESSAGES.TITLE_REQUIRED;
    if (!amount.trim()) nextErrors.amount = DUE_MESSAGES.AMOUNT_REQUIRED;
    else if (Number(amount) <= 0) nextErrors.amount = DUE_MESSAGES.AMOUNT_POSITIVE;
    if (!fromPerson) nextErrors.from = DUE_MESSAGES.FROM_REQUIRED;
    if (!toPerson) nextErrors.to = DUE_MESSAGES.TO_REQUIRED;
    if (fromPerson && toPerson && fromPerson === toPerson) nextErrors.to = DUE_MESSAGES.FROM_TO_DIFFERENT;
    if (!parseDueDateInput(dueDateInput)) nextErrors.dueDate = DUE_MESSAGES.DUE_DATE_REQUIRED;
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

      const result = await addEntry({
        userId: user.id,
        type: 'spending',
        entryType: 'due',
        title: title.trim(),
        amount: Number(amount),
        date: formatDateForDB(new Date()),
        dueDate: formatDateForDB(parseDueDateInput(dueDateInput)),
        dueToPersonId: Number(toPerson),
        isDueOnAccount: true,
        personId: Number(fromPerson),
        showInAccount: true,
        invoiceUri,
        invoiceType,
      });

      if (result.success) {
        showAlert('Success', DUE_MESSAGES.ADD_SUCCESS);
        navigation.goBack();
      } else {
        showAlert('Error', result.message || DUE_MESSAGES.ADD_FAILED);
      }
    } catch {
      showAlert('Error', DUE_MESSAGES.ADD_FAILED);
    } finally {
      setLoading(false);
    }
  };

  const fileType = invoice ? getFileType(invoice.mimeType) : null;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Input
          label="Due Detail"
          value={title}
          onChangeText={(text) => {
            setTitle(text);
            if (errors.title) setErrors((prev) => ({ ...prev, title: null }));
          }}
          placeholder="e.g. Borrowed amount"
          error={errors.title}
        />

        <Input
          label="Amount"
          value={amount}
          onChangeText={(text) => {
            const filtered = text.replace(/[^0-9.]/g, '');
            setAmount(filtered);
            if (errors.amount) setErrors((prev) => ({ ...prev, amount: null }));
          }}
          placeholder="0.00"
          keyboardType="numeric"
          error={errors.amount}
        />

        <Dropdown
          label="From (Current Account)"
          value={fromPerson}
          options={personOptions}
          onSelect={(val) => {
            setFromPerson(val);
            if (errors.from) setErrors((prev) => ({ ...prev, from: null }));
          }}
          placeholder="Select from account"
          error={errors.from}
        />

        <Dropdown
          label="To (Whom it is due)"
          value={toPerson}
          options={personOptions}
          onSelect={(val) => {
            setToPerson(val);
            if (errors.to) setErrors((prev) => ({ ...prev, to: null }));
          }}
          placeholder="Select to account"
          error={errors.to}
        />

        <View style={styles.dateCard}>
          <Text style={styles.inputLabel}>Due Date</Text>
          <Pressable
            style={({ pressed }) => [styles.dateBtn, errors.dueDate && styles.dateBtnError, pressed && { opacity: 0.85 }]}
            onPress={() => {
              const selected = parseDueDateInput(dueDateInput);
              const anchor = selected || new Date();
              setCalendarMonth(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
              setDueDatePickerVisible(true);
            }}
            role="button"
          >
            <Text style={[styles.dateText, !parseDueDateInput(dueDateInput) && styles.datePlaceholder]}>
              {formatDueDateLabel(dueDateInput)}
            </Text>
            <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
          </Pressable>
          {errors.dueDate ? <Text style={styles.errorText}>{errors.dueDate}</Text> : null}
        </View>

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

        <Button title="Add Due" onPress={handleSubmit} loading={loading} style={styles.submitBtn} />
      </ScrollView>

      <AttachmentPicker
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onFilePicked={(file) => setInvoice(file)}
        accentColor={COLORS.warning}
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
              <Pressable style={styles.calendarNavBtn} onPress={() => setCalendarMonth((p) => new Date(p.getFullYear(), p.getMonth() - 1, 1))} role="button">
                <Ionicons name="chevron-back" size={18} color={COLORS.text} />
              </Pressable>
              <Text style={styles.calendarMonthLabel}>{getMonthName(calendarMonth.getMonth() + 1)} {calendarMonth.getFullYear()}</Text>
              <Pressable style={styles.calendarNavBtn} onPress={() => setCalendarMonth((p) => new Date(p.getFullYear(), p.getMonth() + 1, 1))} role="button">
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
                if (!dateObj) return <View key={`empty-${idx}`} style={styles.calendarCell} />;
                const iso = formatDueDateKey(dateObj);
                const selected = iso === dueDateInput;
                return (
                  <Pressable
                    key={iso}
                    style={[styles.calendarCell, selected && styles.calendarCellSelected]}
                    onPress={() => {
                      setDueDateInput(iso);
                      if (errors.dueDate) setErrors((prev) => ({ ...prev, dueDate: null }));
                      setDueDatePickerVisible(false);
                    }}
                    role="button"
                  >
                    <Text style={[styles.calendarCellText, selected && styles.calendarCellTextSelected]}>{dateObj.getDate()}</Text>
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
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { padding: 20, paddingBottom: 36 },
  inputLabel: { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.medium, color: COLORS.text, marginBottom: 6 },
  dateCard: { marginBottom: 16 },
  dateBtn: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateBtnError: { borderColor: COLORS.danger },
  dateText: { fontSize: FONTS.sizes.base, color: COLORS.text },
  datePlaceholder: { color: COLORS.textLight },
  errorText: { marginTop: 4, color: COLORS.danger, fontSize: FONTS.sizes.sm },
  invoiceSection: { marginBottom: 18 },
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
  submitBtn: { backgroundColor: COLORS.warning, marginTop: 8 },
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
  calendarTitle: { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.bold, color: COLORS.text },
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarMonthLabel: { fontSize: FONTS.sizes.base, fontWeight: FONTS.weights.semiBold, color: COLORS.text },
  weekRow: { flexDirection: 'row', marginBottom: 6 },
  weekDayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
    fontWeight: FONTS.weights.semiBold,
  },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarCell: {
    width: '14.285%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  calendarCellSelected: { backgroundColor: COLORS.warning + '26' },
  calendarCellText: { color: COLORS.text, fontSize: FONTS.sizes.sm },
  calendarCellTextSelected: { color: COLORS.warning, fontWeight: FONTS.weights.bold },
});

export default AddDueScreen;
