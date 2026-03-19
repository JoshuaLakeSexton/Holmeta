export type DisplayPlan = {
  monthlyAmount: number;
  yearlyAmount: number;
  currency: string;
  source: "fixed";
};

const FIXED_MONTHLY_USD = 2;
const FIXED_YEARLY_USD = 20;

export function resolveDisplayPlan(_localeInput?: string | null): DisplayPlan {
  return {
    monthlyAmount: FIXED_MONTHLY_USD,
    yearlyAmount: FIXED_YEARLY_USD,
    currency: "USD",
    source: "fixed"
  };
}
