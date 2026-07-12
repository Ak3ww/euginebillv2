import crypto from 'crypto';

export interface QrinTransactionPayload {
  no_ref_merchant: string;
  amount_value: number;
  amount_currency: string;
  product_details: string; // JSON string of array
  validity: string; // Minutes e.g. "60"
  additional_info?: {
    customer_name?: string;
    customer_email?: string;
    customer_phone?: string;
  };
}

export function createQrinClient(tokenQrin: string) {
  const baseUrl = 'https://qrin.web.id/api';

  return {
    getPaymentMethods: async () => {
      const res = await fetch(`${baseUrl}/get-payment-method`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token_qrin: tokenQrin }),
      });
      return res.json();
    },

    createTransaction: async (paymentMethod: string, payload: QrinTransactionPayload) => {
      const requestBody = {
        token_qrin: tokenQrin,
        payment_method: paymentMethod,
        request_payload: payload,
      };

      const res = await fetch(`${baseUrl}/create-transaksi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      return res.json();
    },

    verifyCallbackSignature: (rawBody: string, signature: string) => {
      if (!signature) return false;
      try {
        const expectedHmac = crypto
          .createHmac('sha256', tokenQrin)
          .update(rawBody)
          .digest('hex');
        return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedHmac));
      } catch (err) {
        return false;
      }
    }
  };
}
