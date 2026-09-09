/**
 * Bharat Grassroots Commerce & Fee Receipt Generator
 *
 * Implements:
 * 1. Indian Currency Number-to-Words Engine (Crore, Lakh, Thousand, Hundred, Rupees).
 * 2. NPCI Official Direct UPI URI Generator (P2P/P2M with zero-gateway MDR cuts).
 * 3. Digital Fee Receipt Data Contracts & Verification Signatures.
 */

export interface UpiPaymentParams {
  payeeVpa: string;
  payeeName: string;
  amountPaise: number;
  tournamentSlug: string;
  entryId: string;
  teamName: string;
}

export interface DigitalFeeReceipt {
  receiptId: string;
  tournamentId: string;
  tournamentName: string;
  organizedBy: string;
  associationAffiliation?: string;
  venueName: string;
  city: string;
  state: string;

  divisionName: string;
  teamId: string;
  teamName: string;
  clubName: string;
  captainOrCoachName: string;
  contactPhone: string;
  squadSize: number;

  feeBreakdown: {
    baseEntryFeePaise: number;
    groundMaintenancePaise: number;
    discountPaise: number;
    totalAmountPaise: number;
  };

  paymentDetails: {
    mode: "UPI_DIRECT" | "CASH_ON_PITCH" | "BANK_TRANSFER" | "PAYMENT_GATEWAY" | "WAIVED";
    payeeVpa?: string;
    payerUtr?: string;
    transactionRef: string;
    paidAtIso: string;
    verifiedAtIso: string;
    verifiedByAdminName: string;
    paymentStatus: "PAID_AND_VERIFIED" | "FEE_WAIVED" | "PENDING_RECONCILIATION";
  };

  security: {
    verificationUrl: string;
    hmacSignature: string;
    issuedAtIso: string;
  };
}

/**
 * Converts amount in paise to formal English words under the Indian numbering system
 * (Crore, Lakh, Thousand, Hundred, Rupees).
 * e.g., 250000 -> "Rupees Two Thousand Five Hundred Only"
 */
export function convertRupeesToWordsIndian(amountPaise: number): string {
  const rupees = Math.floor(amountPaise / 100);
  if (rupees === 0) return "Rupees Zero Only";

  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  function formatBelowThousand(n: number): string {
    let str = "";
    if (n >= 100) {
      str += ones[Math.floor(n / 100)] + " Hundred ";
      n %= 100;
    }
    if (n >= 20) {
      str += tens[Math.floor(n / 10)] + " ";
      n %= 10;
    }
    if (n > 0) {
      str += ones[n] + " ";
    }
    return str.trim();
  }

  const crore = Math.floor(rupees / 10000000);
  let remainder = rupees % 10000000;
  const lakh = Math.floor(remainder / 100000);
  remainder %= 100000;
  const thousand = Math.floor(remainder / 1000);
  const hundred = remainder % 1000;

  let result = "";
  if (crore > 0) result += formatBelowThousand(crore) + " Crore ";
  if (lakh > 0) result += formatBelowThousand(lakh) + " Lakh ";
  if (thousand > 0) result += formatBelowThousand(thousand) + " Thousand ";
  if (hundred > 0) result += formatBelowThousand(hundred);

  return `Rupees ${result.trim()} Only`;
}

/**
 * Generates an NPCI-compliant direct UPI Deep Link URI.
 * Directly routes registration fees into the tournament organizer's account without gateway MDR fees.
 */
export function generateGrassrootsUpiUri(params: UpiPaymentParams): string {
  const { payeeVpa, payeeName, amountPaise, tournamentSlug, entryId, teamName } = params;

  // Decimal conversion: integer paise to strict 2-decimal INR string
  const amountRupees = (amountPaise / 100).toFixed(2);

  // Alphanumeric team token for transaction note (max 80 chars total)
  const sanitizedTeam = teamName.replace(/[^a-zA-Z0-9]/g, "").slice(0, 15);
  const transactionNote = `MFB-${tournamentSlug.slice(0, 10)}-${entryId.slice(0, 8)}-${sanitizedTeam}`;
  const transactionRef = `MFB${Date.now().toString().slice(-6)}${entryId.slice(0, 6)}`.toUpperCase();

  const queryParams = new URLSearchParams({
    pa: payeeVpa.trim(),
    pn: payeeName.trim(),
    am: amountRupees,
    cu: "INR",
    tn: transactionNote,
    tr: transactionRef,
    mode: "02",
  });

  return `upi://pay?${queryParams.toString()}`;
}
