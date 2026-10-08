export function computePolicySchedule(input: {
  type: string;
  account: string;
  startDate: string;
  amount: number;
}): PolicySchedule {
  const start = new Date(`${input.startDate}T00:00:00`);
  const startYear = start.getFullYear();
  const startMonth = start.getMonth();
  const startDay = start.getDate();

  const isBinek = input.type === "Binek Araç";
  const kkegAmount = isBinek ? input.amount * 0.3 : 0;
  const baseAmount = input.amount - kkegAmount;
  const dailyAmount = baseAmount / 365;

  const rows: PolicyMonthRow[] = [];
  const totals: Record<string, number> = {
    [input.account]: 0,
    180: 0,
    280: 0,
    kkeg: kkegAmount,
  };

  // 12 ay boyunca gün bazlı dağılım hesaplama
  for (let i = 0; i < 12; i++) {
    const current = new Date(startYear, startMonth + i, 1);
    const year = current.getFullYear();
    const month = current.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // İlk ay için poliçenin başladığı günden ay sonuna kadar olan gün sayısını al
    let days: number;
    if (i === 0) {
      days = daysInMonth - startDay + 1;
    } else if (i === 11) {
      // Son ay, ilk ayın eksik kalan günlerini tamamlar (365 güne tamamlama)
      const previousTotalDays = rows.reduce((acc, r) => acc + r.days, 0);
      days = Math.min(daysInMonth, 365 - previousTotalDays);
      if (days < 0) days = 0;
    } else {
      days = daysInMonth;
    }

    const amount = dailyAmount * days;
    const quarter = Math.floor(month / 3) + 1;

    let accountCode: string;
    if (i === 0) accountCode = input.account;
    else if (year > startYear && month === 0) accountCode = "280";
    else accountCode = "180";

    totals[accountCode] = (totals[accountCode] ?? 0) + amount;

    rows.push({
      year,
      monthIndex: month,
      monthName: MONTH_NAMES[month],
      days,
      amount,
      quarter,
      periodLabel: `${year} / ${quarter}. Dönem`,
      accountCode,
    });
  }

  return { rows, kkegAmount, totals };
}
