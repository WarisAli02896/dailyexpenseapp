import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  TextInput,
  Switch,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Sharing from 'expo-sharing';
import { COLORS } from '../../constants/colors';
import { FONTS } from '../../constants/fonts';
import { ENTRY_TYPES } from '../../constants/categories';
import { formatAmount } from '../../utils/currencyUtils';
import { getMonthName, formatTime12h, formatDate } from '../../utils/dateUtils';
import { deleteEntry, updateEntry, getEntryForDetail, getRepaymentHistoryForDue } from '../../services/entryService';
import { getPersons } from '../../services/personService';
import { saveInvoice, formatFileSize, getFileType } from '../../services/fileService';
import { Button, Dropdown, AttachmentPicker } from '../../components/common';
import { showAlert, showConfirm } from '../../utils/alertUtils';
import { COMMON_MESSAGES } from '../../messages/commonMessages';
import { EXPENSE_MESSAGES } from '../../messages/expenseMessages';
import { DUE_MESSAGES } from '../../messages/dueMessages';
import { useAuth } from '../../hooks/useAuth';

const TYPE_OPTIONS = [
  { value: 'earning', label: 'Earning', icon: 'arrow-down-circle-outline' },
  { value: 'spending', label: 'Spending', icon: 'arrow-up-circle-outline' },
];

const ENTRY_TYPE_OPTIONS = ENTRY_TYPES.map((t) => ({
  value: t.id,
  label: t.label,
  icon: t.icon,
}));

const EntryDetailScreen = ({ route, navigation }) => {
  const { user } = useAuth();
  const { entry: initialEntry } = route.params;
  const [entry, setEntry] = useState(initialEntry);
  const [personOptions, setPersonOptions] = useState([]);
  const [editFromPerson, setEditFromPerson] = useState('');
  const [editToPerson, setEditToPerson] = useState('');
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editType, setEditType] = useState(entry.type);
  const [editEntryType, setEditEntryType] = useState(entry.entry_type);
  const [editTitle, setEditTitle] = useState(entry.title);
  const [editAmount, setEditAmount] = useState(String(entry.amount));
  const [editCompany, setEditCompany] = useState(entry.company_name || '');
  const [editNotes, setEditNotes] = useState(entry.notes || '');
  const [editRecurring, setEditRecurring] = useState(!!entry.is_recurring);
  const [editShowInAccount, setEditShowInAccount] = useState(entry.show_in_account !== 0);
  const [editInvoice, setEditInvoice] = useState(null);
  const [invoiceRemoved, setInvoiceRemoved] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [repayHistory, setRepayHistory] = useState([]);

  const isEarning = entry.type === 'earning';
  const editIsEarning = editType === 'earning';

  useEffect(() => {
    if (!user?.id || !initialEntry?.id) return undefined;
    let cancelled = false;
    (async () => {
      const res = await getEntryForDetail(user.id, initialEntry.id);
      if (!cancelled && res.success && res.data) {
        setEntry(res.data);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, initialEntry?.id]);

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return undefined;
      let cancelled = false;
      (async () => {
        const r = await getPersons(user.id);
        if (!cancelled && r.success) {
          setPersonOptions(r.data.map((p) => ({ value: String(p.id), label: p.name })));
        }
        if (entry.entry_type === 'due' && entry.id) {
          const hr = await getRepaymentHistoryForDue(user.id, entry.id);
          if (!cancelled && hr.success) setRepayHistory(hr.data);
        } else if (!cancelled) {
          setRepayHistory([]);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [user?.id, entry.entry_type, entry.id])
  );
  const entryDate = new Date(entry.date);
  const dateDisplay = `${String(entryDate.getDate()).padStart(2, '0')} ${getMonthName(entryDate.getMonth() + 1)} ${entryDate.getFullYear()}`;
  const dueDateDisplay = entry.due_date
    ? (() => {
        const d = new Date(entry.due_date);
        return `${String(d.getDate()).padStart(2, '0')} ${getMonthName(d.getMonth() + 1)} ${d.getFullYear()}`;
      })()
    : null;
  const timeDisplay = formatTime12h(entry.date);
  const accentColor = editing
    ? (editIsEarning ? COLORS.income : COLORS.expense)
    : (isEarning ? COLORS.income : COLORS.expense);

  const hasInvoice = !!entry.invoice_uri;
  const mime = (entry.invoice_type || '').toLowerCase();
  const invoiceIsImage = hasInvoice && mime.startsWith('image/');

  const getDocInfo = () => {
    if (!hasInvoice || invoiceIsImage) return null;
    if (mime.includes('pdf')) return { label: 'PDF Document', icon: 'document-text', color: '#E53935' };
    if (mime.includes('word') || mime.includes('document') || mime.includes('msword')) return { label: 'Word Document', icon: 'document', color: '#1565C0' };
    return { label: 'Document', icon: 'document-attach', color: COLORS.textSecondary };
  };
  const docInfo = getDocInfo();

  const getFileName = () => {
    const uriName = entry.invoice_uri?.split('/').pop();
    if (uriName && !uriName.startsWith('blob:')) return uriName;
    const ext = mime.split('/').pop() || 'file';
    return `invoice_${entry.id}.${ext === 'jpeg' ? 'jpg' : ext}`;
  };

  const handleDownload = async () => {
    try {
      if (Platform.OS === 'web') {
        const a = document.createElement('a');
        a.href = entry.invoice_uri;
        a.download = getFileName();
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(entry.invoice_uri, {
            mimeType: entry.invoice_type || 'application/octet-stream',
            dialogTitle: 'Save Invoice',
          });
        } else {
          showAlert('Error', EXPENSE_MESSAGES.ENTRY_SHARE_UNAVAILABLE);
        }
      }
    } catch (error) {
      showAlert('Error', EXPENSE_MESSAGES.ENTRY_DOWNLOAD_FAILED);
    }
  };

  const handleDelete = () => {
    showConfirm(
      'Delete Entry',
      `Are you sure you want to delete "${entry.title}"?`,
      async () => {
        setDeleting(true);
        const result = await deleteEntry(entry.id);
        if (result.success) {
          showAlert('Success', result.message || COMMON_MESSAGES.DELETE_SUCCESS);
          navigation.goBack();
        } else {
          showAlert('Error', result.message || COMMON_MESSAGES.DELETE_FAILED);
          setDeleting(false);
        }
      }
    );
  };

  const startEditing = () => {
    setEditType(entry.type);
    setEditEntryType(entry.entry_type);
    setEditTitle(entry.title);
    setEditAmount(String(entry.amount));
    setEditCompany(entry.company_name || '');
    setEditNotes(entry.notes || '');
    setEditRecurring(!!entry.is_recurring);
    setEditShowInAccount(entry.show_in_account !== 0);
    setEditInvoice(null);
    setInvoiceRemoved(false);
    if (entry.entry_type === 'due') {
      setEditFromPerson(entry.person_id != null ? String(entry.person_id) : '');
      setEditToPerson(entry.due_to_person_id != null ? String(entry.due_to_person_id) : '');
    }
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditInvoice(null);
    setInvoiceRemoved(false);
    setEditing(false);
  };

  const handleAmountChange = (text) => {
    const filtered = text.replace(/[^0-9.]/g, '');
    const parts = filtered.split('.');
    setEditAmount(parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : filtered);
  };

  const handleFilePicked = (file) => {
    setEditInvoice(file);
    setInvoiceRemoved(false);
  };

  const handleRemoveInvoice = () => {
    setEditInvoice(null);
    setInvoiceRemoved(true);
  };

  const handleSave = async () => {
    if (!editTitle.trim()) { showAlert('Error', EXPENSE_MESSAGES.ENTRY_TITLE_REQUIRED); return; }
    if (!editAmount.trim() || parseFloat(editAmount) <= 0) { showAlert('Error', EXPENSE_MESSAGES.ENTRY_AMOUNT_INVALID); return; }

    if (entry.entry_type === 'due') {
      if (!editFromPerson) {
        showAlert('Error', DUE_MESSAGES.FROM_REQUIRED);
        return;
      }
      if (!editToPerson) {
        showAlert('Error', DUE_MESSAGES.TO_REQUIRED);
        return;
      }
      if (editFromPerson === editToPerson) {
        showAlert('Error', DUE_MESSAGES.FROM_TO_DIFFERENT);
        return;
      }
    }

    setSaving(true);
    try {
      const updateFields = {
        type: entry.entry_type === 'due' ? 'spending' : editType,
        entryType: entry.entry_type === 'due' ? 'due' : editEntryType,
        title: editTitle.trim(),
        amount: parseFloat(editAmount),
        companyName: editCompany.trim() || null,
        notes: editNotes.trim() || null,
        isRecurring: editRecurring,
        showInAccount: editShowInAccount,
      };

      if (entry.entry_type === 'due') {
        updateFields.personId = Number(editFromPerson);
        updateFields.dueToPersonId = Number(editToPerson);
      }

      if (editInvoice) {
        const savedUri = await saveInvoice(editInvoice.uri, editInvoice.name);
        updateFields.invoiceUri = savedUri;
        updateFields.invoiceType = editInvoice.mimeType || null;
      } else if (invoiceRemoved) {
        updateFields.invoiceUri = null;
        updateFields.invoiceType = null;
      }

      const result = await updateEntry(entry.id, updateFields);

      if (result.success) {
        setEntry(result.data);
        setEditInvoice(null);
        setInvoiceRemoved(false);
        setEditing(false);
        showAlert('Success', result.message || COMMON_MESSAGES.UPDATE_SUCCESS);
      } else {
        showAlert('Error', result.message || COMMON_MESSAGES.UPDATE_FAILED);
      }
    } catch (error) {
      showAlert('Error', COMMON_MESSAGES.UPDATE_FAILED);
    }
    setSaving(false);
  };

  const entryTypeLabel = (val) => {
    const found = ENTRY_TYPES.find((t) => t.id === val);
    return found ? found.label : val?.charAt(0).toUpperCase() + val?.slice(1);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Top Row: Badge + Edit */}
      <View style={styles.topRow}>
        <View style={[styles.typeBadge, { backgroundColor: accentColor + '14' }]}>
          <Ionicons
            name={(editing ? editIsEarning : isEarning) ? 'arrow-down-circle' : 'arrow-up-circle'}
            size={20}
            color={accentColor}
          />
          <Text style={[styles.typeBadgeText, { color: accentColor }]}>
            {(editing ? editIsEarning : isEarning) ? 'Earning' : 'Spending'}
          </Text>
        </View>
        {!editing && (
          <Pressable
            style={({ pressed }) => [styles.editBtn, pressed && { opacity: 0.7 }]}
            onPress={startEditing}
            role="button"
          >
            <Ionicons name="create-outline" size={18} color={COLORS.primary} />
            <Text style={styles.editBtnText}>Edit</Text>
          </Pressable>
        )}
      </View>

      {/* Amount */}
      {editing ? (
        <View style={[styles.amountEditCard, { borderColor: accentColor + '40' }]}>
          <Text style={[styles.amountEditLabel, { color: accentColor }]}>
            {editIsEarning ? 'Amount Earned' : 'Amount Spent'}
          </Text>
          <View style={styles.amountEditRow}>
            <Text style={[styles.amountEditCurrency, { color: accentColor }]}>Rs.</Text>
            <TextInput
              style={[styles.amountEditInput, { color: accentColor, borderBottomColor: accentColor + '30' }]}
              value={editAmount}
              onChangeText={handleAmountChange}
              keyboardType="numeric"
              placeholder="0.00"
              placeholderTextColor={COLORS.textLight}
            />
          </View>
        </View>
      ) : (
        <View style={[styles.amountCard, { backgroundColor: accentColor }]}>
          <Text style={styles.amountLabel}>{isEarning ? 'Amount Earned' : 'Amount Spent'}</Text>
          <Text style={styles.amountValue}>
            {isEarning ? '+' : '-'} Rs. {formatAmount(entry.amount)}
          </Text>
        </View>
      )}

      {/* Details */}
      <View style={styles.detailsCard}>
        <Text style={styles.sectionTitle}>Details</Text>

        {editing ? (
          <View>
            {entry.entry_type === 'due' ? (
              <>
                <DetailRow icon="arrow-up-circle-outline" label="Type" value="Spending" />
                <DetailRow icon="receipt-outline" label="Category" value="Due" />
                <Dropdown
                  label={DUE_MESSAGES.EDIT_FROM_ACCOUNT_LABEL}
                  value={editFromPerson}
                  options={personOptions}
                  onSelect={(val) => setEditFromPerson(val)}
                  placeholder={DUE_MESSAGES.SELECT_FROM_ACCOUNT}
                />
                <Dropdown
                  label={DUE_MESSAGES.EDIT_TO_ACCOUNT_LABEL}
                  value={editToPerson}
                  options={personOptions}
                  onSelect={(val) => setEditToPerson(val)}
                  placeholder={DUE_MESSAGES.SELECT_TO_ACCOUNT}
                />
              </>
            ) : (
              <>
                <Text style={styles.editFieldLabel}>Type</Text>
                <View style={styles.toggleRow}>
                  {TYPE_OPTIONS.map((opt) => {
                    const selected = editType === opt.value;
                    const color = opt.value === 'earning' ? COLORS.income : COLORS.expense;
                    return (
                      <Pressable
                        key={opt.value}
                        style={[styles.toggleOption, selected && { backgroundColor: color + '14', borderColor: color }]}
                        onPress={() => setEditType(opt.value)}
                        role="button"
                      >
                        <Ionicons name={opt.icon} size={18} color={selected ? color : COLORS.textLight} />
                        <Text style={[styles.toggleOptionText, selected && { color, fontWeight: FONTS.weights.bold }]}>
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Dropdown
                  label="Category"
                  value={editEntryType}
                  options={ENTRY_TYPE_OPTIONS}
                  onSelect={setEditEntryType}
                  placeholder="Select entry type"
                />
              </>
            )}

            <EditField label="Title" value={editTitle} onChangeText={setEditTitle} placeholder="Entry title" />

            <EditField label="Company" value={editCompany} onChangeText={setEditCompany} placeholder="Company name (optional)" />

            {entry.entry_type !== 'due' && entry.person_name ? (
              <DetailRow icon="person-outline" label="Account" value={entry.person_name} />
            ) : null}

            <DetailRow icon="calendar-outline" label="Date" value={dateDisplay} />
            {dueDateDisplay ? <DetailRow icon="calendar-clear-outline" label="Due Date" value={dueDateDisplay} /> : null}
            {timeDisplay ? <DetailRow icon="time-outline" label="Time" value={timeDisplay} /> : null}

            <View style={styles.recurringRow}>
              <View style={styles.recurringLeft}>
                <View style={styles.recurringIconWrap}>
                  <Ionicons name="repeat" size={18} color={COLORS.primary} />
                </View>
                <View>
                  <Text style={styles.recurringLabel}>Monthly Recurring</Text>
                  <Text style={styles.recurringHint}>Repeat this entry every month</Text>
                </View>
              </View>
              <Switch
                value={editRecurring}
                onValueChange={setEditRecurring}
                trackColor={{ false: COLORS.border, true: COLORS.primaryLight }}
                thumbColor={editRecurring ? COLORS.primary : COLORS.textLight}
              />
            </View>

            <View
              style={[
                styles.recurringRow,
                !(entry.entry_type === 'due' ? editFromPerson : entry.person_id) && { opacity: 0.5 },
              ]}
            >
              <View style={styles.recurringLeft}>
                <View style={styles.recurringIconWrap}>
                  <Ionicons
                    name="eye-outline"
                    size={18}
                    color={(entry.entry_type === 'due' ? editFromPerson : entry.person_id) ? accentColor : COLORS.textLight}
                  />
                </View>
                <View>
                  <Text style={styles.recurringLabel}>Show in Account</Text>
                  <Text style={styles.recurringHint}>
                    {(entry.entry_type === 'due' ? editFromPerson : entry.person_id)
                      ? 'Visible in account profile'
                      : 'No account linked'}
                  </Text>
                </View>
              </View>
              <Switch
                value={(entry.entry_type === 'due' ? editFromPerson : entry.person_id) ? editShowInAccount : false}
                onValueChange={setEditShowInAccount}
                disabled={!(entry.entry_type === 'due' ? editFromPerson : entry.person_id)}
                trackColor={{ false: COLORS.border, true: accentColor + '80' }}
                thumbColor={
                  (entry.entry_type === 'due' ? editFromPerson : entry.person_id) && editShowInAccount
                    ? accentColor
                    : COLORS.textLight
                }
              />
            </View>

            <EditField label="Notes" value={editNotes} onChangeText={setEditNotes} placeholder="Add notes (optional)" multiline />
          </View>
        ) : (
          <>
            <DetailRow icon="document-text-outline" label="Title" value={entry.title} />
            <DetailRow icon="briefcase-outline" label="Type" value={entryTypeLabel(entry.entry_type)} />
            {entry.company_name ? <DetailRow icon="business-outline" label="Company" value={entry.company_name} /> : null}
            {entry.entry_type === 'due' ? (
              <>
                <DetailRow
                  icon="arrow-up-circle-outline"
                  label={DUE_MESSAGES.EDIT_FROM_ACCOUNT_LABEL}
                  value={entry.from_person_name || entry.person_name || '—'}
                />
                <DetailRow
                  icon="arrow-down-circle-outline"
                  label={DUE_MESSAGES.EDIT_TO_ACCOUNT_LABEL}
                  value={entry.due_to_person_name || '—'}
                />
              </>
            ) : entry.person_name ? (
              <DetailRow icon="person-outline" label="Account" value={entry.person_name} />
            ) : null}
            <DetailRow icon="calendar-outline" label="Date" value={dateDisplay} />
            {dueDateDisplay ? <DetailRow icon="calendar-clear-outline" label="Due Date" value={dueDateDisplay} /> : null}
            {timeDisplay ? <DetailRow icon="time-outline" label="Time" value={timeDisplay} /> : null}
            <DetailRow icon="repeat-outline" label="Recurring" value={entry.is_recurring ? 'Yes — Monthly' : 'No'} />
            {entry.person_id ? (
              <DetailRow icon="eye-outline" label="Show in Account" value={entry.show_in_account !== 0 ? 'Yes' : 'No'} />
            ) : null}
            {entry.notes ? <DetailRow icon="chatbox-ellipses-outline" label="Notes" value={entry.notes} /> : null}
          </>
        )}
      </View>

      {!editing && entry.entry_type === 'due' ? (
        <View style={styles.detailsCard}>
          <Text style={styles.sectionTitle}>{DUE_MESSAGES.REPAY_HISTORY_TITLE}</Text>
          {repayHistory.length === 0 ? (
            <Text style={styles.historyEmpty}>{DUE_MESSAGES.REPAY_HISTORY_EMPTY}</Text>
          ) : (
            repayHistory.map((row) => (
              <View key={row.id} style={styles.historyRow}>
                <View style={styles.historyRowTop}>
                  <Text style={styles.historyAmount}>+ Rs. {formatAmount(Number(row.amount))}</Text>
                  <Text style={styles.historyWhen}>
                    {formatDate(row.date)} · {formatTime12h(row.date)}
                  </Text>
                </View>
                {row.notes ? <Text style={styles.historyNote}>{row.notes}</Text> : null}
              </View>
            ))
          )}
        </View>
      ) : null}

      {/* Invoice / Receipt */}
      {editing ? (
        <View style={styles.invoiceCard}>
          <Text style={styles.sectionTitle}>Invoice / Receipt</Text>

          {editInvoice ? (
            <View style={styles.invoicePreviewRow}>
              <View style={styles.invoicePreviewLeft}>
                {getFileType(editInvoice.mimeType) === 'image' ? (
                  <Image source={{ uri: editInvoice.uri }} style={styles.invoiceThumbnail} />
                ) : (
                  <View style={[styles.invoiceFileIcon, getFileType(editInvoice.mimeType) === 'pdf' ? styles.pdfBg : styles.docBg]}>
                    <Ionicons name={getFileType(editInvoice.mimeType) === 'pdf' ? 'document-text' : 'document'} size={24} color={COLORS.textWhite} />
                  </View>
                )}
                <View style={styles.invoicePreviewInfo}>
                  <Text style={styles.invoicePreviewName} numberOfLines={1}>{editInvoice.name}</Text>
                  <Text style={styles.invoicePreviewSize}>{formatFileSize(editInvoice.size)}</Text>
                </View>
              </View>
              <Pressable
                style={({ pressed }) => [styles.invoiceRemoveBtn, pressed && { opacity: 0.6 }]}
                onPress={() => setEditInvoice(null)}
                role="button"
                hitSlop={8}
              >
                <Ionicons name="close-circle" size={24} color={COLORS.danger} />
              </Pressable>
            </View>
          ) : hasInvoice && !invoiceRemoved ? (
            <View style={styles.invoicePreviewRow}>
              <View style={styles.invoicePreviewLeft}>
                {invoiceIsImage ? (
                  <Image source={{ uri: entry.invoice_uri }} style={styles.invoiceThumbnail} />
                ) : (
                  <View style={[styles.invoiceFileIcon, docInfo ? { backgroundColor: docInfo.color } : styles.docBg]}>
                    <Ionicons name={docInfo?.icon || 'document-attach'} size={24} color={COLORS.textWhite} />
                  </View>
                )}
                <View style={styles.invoicePreviewInfo}>
                  <Text style={styles.invoicePreviewName} numberOfLines={1}>{getFileName()}</Text>
                  <Text style={styles.invoicePreviewSize}>Current attachment</Text>
                </View>
              </View>
              <Pressable
                style={({ pressed }) => [styles.invoiceRemoveBtn, pressed && { opacity: 0.6 }]}
                onPress={handleRemoveInvoice}
                role="button"
                hitSlop={8}
              >
                <Ionicons name="close-circle" size={24} color={COLORS.danger} />
              </Pressable>
            </View>
          ) : null}

          <View style={styles.invoiceEditActions}>
            <Pressable
              style={({ pressed }) => [styles.invoicePickBtn, pressed && { opacity: 0.8 }]}
              onPress={() => setPickerVisible(true)}
              role="button"
            >
              <Ionicons name="camera-outline" size={20} color={COLORS.primary} />
              <Text style={styles.invoicePickBtnText}>
                {(hasInvoice && !invoiceRemoved) || editInvoice ? 'Replace File' : 'Attach File'}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : hasInvoice ? (
        <View style={styles.invoiceCard}>
          <Text style={styles.sectionTitle}>Invoice / Receipt</Text>
          {invoiceIsImage ? (
            <View style={styles.imageSection}>
              <View style={styles.imageContainer}>
                <Image source={{ uri: entry.invoice_uri }} style={styles.invoiceImage} resizeMode="contain" />
              </View>
              <Pressable
                style={({ pressed }) => [styles.downloadBtn, styles.downloadImageBtn, pressed && { opacity: 0.8 }]}
                onPress={handleDownload}
                role="button"
              >
                <Ionicons name="download-outline" size={20} color={COLORS.textWhite} />
                <Text style={styles.downloadBtnText}>Download Image</Text>
              </Pressable>
            </View>
          ) : docInfo ? (
            <View style={styles.docContainer}>
              <View style={[styles.docIconBox, { backgroundColor: docInfo.color }]}>
                <Ionicons name={docInfo.icon} size={36} color={COLORS.textWhite} />
              </View>
              <Text style={styles.docLabel}>{docInfo.label}</Text>
              <Text style={styles.docFileName} numberOfLines={2}>{getFileName()}</Text>
              <Pressable
                style={({ pressed }) => [styles.downloadBtn, pressed && { opacity: 0.8 }]}
                onPress={handleDownload}
                role="button"
              >
                <Ionicons name="download-outline" size={20} color={COLORS.textWhite} />
                <Text style={styles.downloadBtnText}>Download</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Actions */}
      {editing ? (
        <View style={styles.editActions}>
          <Pressable
            style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.7 }]}
            onPress={cancelEditing}
            role="button"
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </Pressable>
          <Button title="Save Changes" onPress={handleSave} loading={saving} style={styles.saveBtn} />
        </View>
      ) : (
        <Button
          title="Delete Entry"
          onPress={handleDelete}
          loading={deleting}
          style={styles.deleteButton}
          textStyle={styles.deleteBtnText}
        />
      )}

      <AttachmentPicker
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onFilePicked={handleFilePicked}
        accentColor={accentColor}
      />
    </ScrollView>
  );
};

const DetailRow = ({ icon, label, value }) => (
  <View style={styles.detailRow}>
    <View style={styles.detailIcon}>
      <Ionicons name={icon} size={18} color={COLORS.primary} />
    </View>
    <View style={styles.detailContent}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  </View>
);

const EditField = ({ label, value, onChangeText, placeholder, multiline }) => (
  <View style={styles.editField}>
    <Text style={styles.editFieldLabel}>{label}</Text>
    <TextInput
      style={[styles.editFieldInput, multiline && styles.editFieldMultiline]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={COLORS.textLight}
      multiline={multiline}
      numberOfLines={multiline ? 3 : 1}
    />
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { padding: 20, paddingBottom: 40 },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  typeBadgeText: { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.semiBold },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '12',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  editBtnText: { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.semiBold, color: COLORS.primary },

  amountCard: { borderRadius: 18, padding: 24, alignItems: 'center', marginBottom: 20 },
  amountLabel: { fontSize: FONTS.sizes.md, color: 'rgba(255,255,255,0.75)', marginBottom: 8 },
  amountValue: { fontSize: 34, fontWeight: FONTS.weights.extraBold, color: COLORS.textWhite },

  amountEditCard: {
    borderRadius: 18, padding: 24, alignItems: 'center', marginBottom: 20,
    backgroundColor: COLORS.surface, borderWidth: 2,
  },
  amountEditLabel: { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.medium, marginBottom: 8 },
  amountEditRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  amountEditCurrency: { fontSize: 28, fontWeight: FONTS.weights.bold },
  amountEditInput: {
    fontSize: 34, fontWeight: FONTS.weights.extraBold, minWidth: 100,
    textAlign: 'center', paddingVertical: 4, borderBottomWidth: 2,
  },

  detailsCard: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 20, marginBottom: 16 },
  sectionTitle: { fontSize: FONTS.sizes.lg, fontWeight: FONTS.weights.bold, color: COLORS.text, marginBottom: 16 },

  detailRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  detailIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: COLORS.primary + '10', justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  detailContent: { flex: 1 },
  detailLabel: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginBottom: 2 },
  detailValue: { fontSize: FONTS.sizes.base, fontWeight: FONTS.weights.medium, color: COLORS.text },

  toggleRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  toggleOption: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 12, borderRadius: 12,
    backgroundColor: COLORS.background, borderWidth: 1.5, borderColor: COLORS.borderLight,
  },
  toggleOptionText: { fontSize: FONTS.sizes.md, color: COLORS.textSecondary },

  editField: { marginBottom: 16 },
  editFieldLabel: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, marginBottom: 6 },
  editFieldInput: {
    fontSize: FONTS.sizes.base, color: COLORS.text, backgroundColor: COLORS.background,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: COLORS.primary + '30',
  },
  editFieldMultiline: { minHeight: 80, textAlignVertical: 'top' },

  recurringRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.background, borderRadius: 14, padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: COLORS.borderLight,
  },
  recurringLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  recurringIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.primary + '14', justifyContent: 'center', alignItems: 'center',
  },
  recurringLabel: { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.semiBold, color: COLORS.text, marginBottom: 2 },
  recurringHint: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary },

  historyEmpty: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary },
  historyRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  historyRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  historyAmount: {
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.bold,
    color: COLORS.income,
  },
  historyWhen: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary },
  historyNote: {
    marginTop: 6,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },

  invoiceCard: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 20, marginBottom: 16 },
  imageSection: { alignItems: 'center' },
  imageContainer: { borderRadius: 12, overflow: 'hidden', backgroundColor: COLORS.borderLight, width: '100%' },
  downloadImageBtn: { marginTop: 16 },
  invoiceImage: { width: '100%', height: 350, backgroundColor: COLORS.borderLight },
  docContainer: { alignItems: 'center', paddingVertical: 20 },
  docIconBox: { width: 72, height: 72, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  docLabel: { fontSize: FONTS.sizes.base, fontWeight: FONTS.weights.semiBold, color: COLORS.text, marginBottom: 4 },
  docFileName: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 18, maxWidth: '80%' },
  downloadBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary,
    paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, gap: 8,
  },
  downloadBtnText: { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.semiBold, color: COLORS.textWhite },

  editActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: COLORS.surface, paddingVertical: 16, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.border,
  },
  cancelBtnText: { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.semiBold, color: COLORS.textSecondary },
  saveBtn: { flex: 2 },
  invoicePreviewRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.background, borderRadius: 12, padding: 12, marginBottom: 12,
    borderWidth: 1, borderColor: COLORS.borderLight,
  },
  invoicePreviewLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  invoiceThumbnail: { width: 48, height: 48, borderRadius: 10, backgroundColor: COLORS.borderLight },
  invoiceFileIcon: { width: 48, height: 48, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  pdfBg: { backgroundColor: '#E53935' },
  docBg: { backgroundColor: '#1565C0' },
  invoicePreviewInfo: { flex: 1 },
  invoicePreviewName: { fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.semiBold, color: COLORS.text, marginBottom: 2 },
  invoicePreviewSize: { fontSize: FONTS.sizes.xs, color: COLORS.textSecondary },
  invoiceRemoveBtn: { padding: 4 },
  invoiceEditActions: { alignItems: 'center' },
  invoicePickBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.primary + '10', paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 12, borderWidth: 1, borderColor: COLORS.primary + '25',
  },
  invoicePickBtnText: { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.semiBold, color: COLORS.primary },

  deleteButton: { backgroundColor: COLORS.danger, marginTop: 8 },
  deleteBtnText: { color: COLORS.textWhite },
});

export default EntryDetailScreen;
