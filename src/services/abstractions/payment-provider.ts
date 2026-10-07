/**
 * طبقة تجريد الدفع — جاهزة لعربون/دفع مسبق لاحقاً دون تعديل الحجز.
 */
export type PaymentIntentStatus = 'created' | 'paid' | 'failed' | 'refunded';

export interface PaymentIntent {
  id: string;
  appointmentId: string;
  amount: number;
  currency: 'DZD';
  status: PaymentIntentStatus;
  provider: string;
}

export interface PaymentProvider {
  id: string;
  isConfigured(): boolean;
  createDepositIntent(appointmentId: string, amount: number): Promise<PaymentIntent>;
}

/** لا دفع حالياً — البنية جاهزة لعربون (CIB / BaridiMob / SATIM) */
export const noopPaymentProvider: PaymentProvider = {
  id: 'noop',
  isConfigured: () => false,
  async createDepositIntent(appointmentId, amount) {
    return {
      id: `pi_noop_${appointmentId}`,
      appointmentId,
      amount,
      currency: 'DZD',
      status: 'created',
      provider: 'noop',
    };
  },
};

let current: PaymentProvider = noopPaymentProvider;

export function getPaymentProvider(): PaymentProvider {
  return current;
}

export function setPaymentProvider(p: PaymentProvider) {
  current = p;
}
