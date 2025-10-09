export default function generateInstallments(total, count, firstDueDate) {
  if (!count || count <= 1) return [];
  const installments = [];
  const base = Math.round((total / count) * 100) / 100;
  let remainder = Math.round((total - base * count) * 100) / 100; // pequeno ajuste centavos
  const first = firstDueDate ? new Date(firstDueDate) : new Date();
  for (let i = 1; i <= count; i++) {
    const due = new Date(first);
    due.setMonth(first.getMonth() + (i - 1));
    let amount = base;
    if (remainder > 0) { amount = Math.round((amount + 0.01) * 100) / 100; remainder = Math.round((remainder - 0.01) * 100) / 100; }
    installments.push({ number: i, dueDate: due, amount });
  }
  return installments;
}
