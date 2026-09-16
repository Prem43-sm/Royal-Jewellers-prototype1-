export interface JewelleryCalculationInput {
  metal: string;
  purity: number;
  fineness: number;
  grossWeight: number;
  stoneWeight: number;
  otherMaterialWeight: number;
  rate: number;
  makingCharge: number;
  wastagePercent: number;
  wastageAmount: number;
  stoneCharge: number;
  otherCharge: number;
  discount: number;
  taxRate: number;
  quantity?: number;
}

export interface JewelleryCalculationResult {
  netWeight: number;
  fineGoldWeight: number;
  metalValue: number;
  makingCharge: number;
  wastageAmount: number;
  stoneCharge: number;
  otherCharge: number;
  taxableValue: number;
  discount: number;
  taxAmount: number;
  taxRate: number;
  finalValue: number;
}

export function calculatePurityFineness(purity: number): number {
  if (purity <= 0) return 0;
  if (purity > 24) return 1;
  return purity / 24;
}

export function calculateNetWeight(
  grossWeight: number,
  stoneWeight: number,
  otherMaterialWeight: number
): number {
  return Math.max(0, grossWeight - (stoneWeight || 0) - (otherMaterialWeight || 0));
}

export function calculateFineGoldWeight(
  netWeight: number,
  fineness: number
): number {
  return netWeight * fineness;
}

export function calculateMetalValue(netWeight: number, rate: number): number {
  return netWeight * rate;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function calculateJewelleryPrice(input: JewelleryCalculationInput): JewelleryCalculationResult {
  const quantity = input.quantity || 1;
  const netWeight = calculateNetWeight(input.grossWeight, input.stoneWeight, input.otherMaterialWeight);
  const fineness = input.fineness > 0 ? input.fineness : calculatePurityFineness(input.purity);
  const fineGoldWeight = calculateFineGoldWeight(netWeight, fineness);
  const metalValue = calculateMetalValue(netWeight, input.rate);

  const making = input.makingCharge || 0;
  const wastage = input.wastageAmount > 0
    ? input.wastageAmount
    : metalValue * ((input.wastagePercent || 0) / 100);

  const stoneCharge = input.stoneCharge || 0;
  const otherCharge = input.otherCharge || 0;
  const discount = input.discount || 0;

  const taxableValue = Math.max(0, metalValue + making + wastage + stoneCharge + otherCharge - discount);
  const taxRate = input.taxRate || 0;
  const taxAmount = taxableValue * (taxRate / 100);
  const finalValue = Math.max(0, taxableValue + taxAmount);

  return {
    netWeight: round2(netWeight),
    fineGoldWeight: round2(fineGoldWeight),
    metalValue: round2(metalValue),
    makingCharge: round2(making),
    wastageAmount: round2(wastage),
    stoneCharge: round2(stoneCharge),
    otherCharge: round2(otherCharge),
    taxableValue: round2(taxableValue),
    discount: round2(discount),
    taxAmount: round2(taxAmount),
    taxRate,
    finalValue: round2(finalValue * quantity),
  };
}

export interface OldGoldValuationInput {
  grossWeight: number;
  stoneWeight: number;
  otherMaterialWeight: number;
  testedPurity: number;
  rate: number;
  deduction: number;
}

export interface OldGoldValuationResult {
  netWeight: number;
  fineness: number;
  fineGoldWeight: number;
  grossValue: number;
  finalValue: number;
}

export function calculateOldGoldValue(input: OldGoldValuationInput): OldGoldValuationResult {
  const netWeight = calculateNetWeight(input.grossWeight, input.stoneWeight, input.otherMaterialWeight);
  const fineness = calculatePurityFineness(input.testedPurity);
  const fineGoldWeight = calculateFineGoldWeight(netWeight, fineness);
  const grossValue = fineGoldWeight * input.rate;
  const finalValue = Math.max(0, grossValue - (input.deduction || 0));

  return {
    netWeight: round2(netWeight),
    fineness: round2(fineness),
    fineGoldWeight: round2(fineGoldWeight),
    grossValue: round2(grossValue),
    finalValue: round2(finalValue),
  };
}