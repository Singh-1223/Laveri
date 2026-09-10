export type HouseholdMonth = { monthKey: string; consumedMl: number; ratePaisePerLitre: number | null; selfPaymentPaise: number; settingsId: string | null };
export type SaveHouseholdMonthInput = { farmId: string; userId: string; monthKey: string; ratePaisePerLitre: number | null; selfPaymentPaise: number };
