import type { HouseholdMonth, SaveHouseholdMonthInput } from './household-consumption.types';
const unavailable = () => new Error('Household consumption requires the Android or iOS development build.');
export async function listHouseholdMonths(_farmId: string): Promise<HouseholdMonth[]> { throw unavailable(); }
export async function saveHouseholdMonth(_input: SaveHouseholdMonthInput) { throw unavailable(); }
