import type { MilkLaunchTarget, MilkSessionSnapshot, ReorderMilkAnimalsInput, SaveMilkSessionInput, VoidMilkSessionInput } from './milk.types';

const unavailable = () => new Error('Offline milk entry requires the Android or iOS development build.');

export async function loadMilkSession(
  _farmId: string,
  _milkDate: string,
  _session: 'morning' | 'evening',
): Promise<MilkSessionSnapshot> {
  throw unavailable();
}

export async function getMilkLaunchTarget(_farmId: string): Promise<MilkLaunchTarget> {
  throw unavailable();
}

export async function saveMilkSession(_input: SaveMilkSessionInput) {
  throw unavailable();
}

export async function voidMilkSession(_input: VoidMilkSessionInput) {
  throw unavailable();
}

export async function reorderMilkAnimals(_input: ReorderMilkAnimalsInput) {
  throw unavailable();
}
