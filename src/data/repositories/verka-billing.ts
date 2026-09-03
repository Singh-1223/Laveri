import type { SaveVerkaCycleInput, VerkaCycleSnapshot } from './verka-billing.types';
const unavailable = () => new Error('Offline Verka billing requires the Android or iOS development build.');
export async function loadVerkaCycles(_farmId: string, _buyerId: string): Promise<VerkaCycleSnapshot> { throw unavailable(); }
export async function saveVerkaCycle(_input: SaveVerkaCycleInput) { throw unavailable(); }
