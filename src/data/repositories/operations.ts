import type {
    CreateFeedInput,
    CreateHeatInput,
    CreateOtherEventInput,
    CreateProductInput,
    CreateTreatmentInput,
    OperationHistoryRow,
    UpdateFeedInput,
    UpdateHeatInput,
    UpdateProductInput,
    UpdateTreatmentInput,
    VoidOperationInput,
} from './operations.types';

const unavailable = () => new Error('Offline farm operations require the Android or iOS development build.');

export async function listRecentOperations(_farmId: string, _limit = 50): Promise<OperationHistoryRow[]> {
  throw unavailable();
}

export async function listTreatmentAnimalIds(_farmId: string, _treatmentId: string): Promise<string[]> { throw unavailable(); }
export async function createFeedTransaction(_input: CreateFeedInput) { throw unavailable(); }
export async function createTreatment(_input: CreateTreatmentInput) { throw unavailable(); }
export async function createProductTransaction(_input: CreateProductInput) { throw unavailable(); }
export async function createHeatEvent(_input: CreateHeatInput) { throw unavailable(); }
export async function createOtherEvents(_input: CreateOtherEventInput) { throw unavailable(); }
export async function updateFeedTransaction(_input: UpdateFeedInput) { throw unavailable(); }
export async function updateTreatment(_input: UpdateTreatmentInput) { throw unavailable(); }
export async function updateProductTransaction(_input: UpdateProductInput) { throw unavailable(); }
export async function updateHeatEvent(_input: UpdateHeatInput) { throw unavailable(); }
export async function voidOperation(_input: VoidOperationInput) { throw unavailable(); }
