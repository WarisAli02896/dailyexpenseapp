/**
 * @param {object} due - due entry row
 * @param {object[]} repaymentsAll - earning + spending repayment rows linked to the due
 */
export const computeDueRepayStats = (due, repaymentsAll = []) => {
  const earningRepayments = repaymentsAll.filter(
    (r) => r.entry_type === 'repayment' && r.type === 'earning'
  );
  const totalRepaid = earningRepayments.reduce((s, r) => s + Number(r.amount || 0), 0);
  const principal = Number(due?.amount || 0);
  const remaining = Math.max(0, principal - totalRepaid);
  const sortedEarning = [...earningRepayments].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const isFullyRepaid = remaining <= 0.0001;
  const showRepayButton = remaining > 0.0001;
  return {
    earningRepayments: sortedEarning,
    totalRepaid,
    remaining,
    principal,
    isFullyRepaid,
    showRepayButton,
    latestRepayment: sortedEarning[0] || null,
  };
};
