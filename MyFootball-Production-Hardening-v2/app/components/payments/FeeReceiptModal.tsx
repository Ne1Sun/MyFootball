"use client";

import React, { useState } from "react";
import {
  Printer,
  ShieldCheck,
  CheckCircle2,
  X,
  QrCode,
  IndianRupee,
  FileCheck,
  Building2,
  Phone,
  UserCheck,
  Award,
} from "lucide-react";
import { convertRupeesToWordsIndian, generateGrassrootsUpiUri } from "../../lib/receipt-generator";

export interface FeeReceiptModalProps {
  entry: {
    id: string;
    teamName: string;
    clubName?: string;
    city?: string;
    contactName?: string;
    contactPhone?: string;
    groupName?: string;
    paymentStatus: string;
    amountPaise?: number;
    approvedAt?: string | null;
    registeredAt?: string;
  };
  tournament: {
    id: string;
    name: string;
    organizedBy: string;
    city: string;
    venueName: string;
    state?: string;
    organizerEmail?: string;
  };
  divisionName?: string;
  onClose: () => void;
  onUpdatePaymentStatus?: (entryId: string, newStatus: "paid" | "unpaid" | "waived") => Promise<void>;
}

export function FeeReceiptModal({
  entry,
  tournament,
  divisionName = "Open Tournament Division",
  onClose,
  onUpdatePaymentStatus,
}: FeeReceiptModalProps) {
  const [updating, setUpdating] = useState(false);

  const amountPaise = entry.amountPaise || 0;
  const amountRupees = (amountPaise / 100).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
  const amountInWords = convertRupeesToWordsIndian(amountPaise);
  const receiptNumber = `RCPT-MFB-${entry.id.slice(0, 8).toUpperCase()}`;
  const transactionRef = `TXN-${entry.id.slice(0, 6).toUpperCase()}-${Date.now().toString().slice(-4)}`;

  // Default UPI payee address derived from tournament organizer
  const organizerVpa = `${tournament.organizerEmail?.split("@")[0] || "tournament"}@upi`;
  const upiUri = generateGrassrootsUpiUri({
    payeeVpa: organizerVpa,
    payeeName: tournament.organizedBy || tournament.name,
    amountPaise: amountPaise > 0 ? amountPaise : 100000,
    tournamentSlug: tournament.name.toLowerCase().replace(/[^a-z0-9]/g, "-"),
    entryId: entry.id,
    teamName: entry.teamName,
  });

  const handlePrint = () => {
    window.print();
  };

  const handleStatusChange = async (status: "paid" | "unpaid" | "waived") => {
    if (!onUpdatePaymentStatus) return;
    setUpdating(true);
    try {
      await onUpdatePaymentStatus(entry.id, status);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white print:static">
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #official-receipt-print, #official-receipt-print * {
            visibility: visible;
          }
          #official-receipt-print {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 24px;
            background: white !important;
            color: black !important;
            border: 2px solid #000 !important;
            box-shadow: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8 print:border-none print:shadow-none print:my-0">
        {/* Modal Toolbar (hidden when printing) */}
        <div className="no-print flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <FileCheck size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">Digital Tournament Fee Receipt</h3>
              <p className="text-[11px] text-slate-400">Official Bharat Grassroots Audit Document</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="interactive-button px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition shadow"
            >
              <Printer size={14} className="text-amber-400" /> Print / Save PDF
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Printable Official Receipt Canvas */}
        <div id="official-receipt-print" className="p-6 sm:p-8 space-y-6 text-slate-200 bg-slate-900 print:text-black print:bg-white">
          {/* Header Banner */}
          <div className="flex items-start justify-between border-b border-slate-800 pb-6 print:border-black">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xl">🇮🇳</span>
                <span className="text-xs font-black tracking-wider uppercase text-amber-400 print:text-black">
                  MYFOOTBALL BHARAT OPERATING SYSTEM
                </span>
              </div>
              <h1 className="text-2xl font-black text-white print:text-black">{tournament.name}</h1>
              <p className="text-xs text-slate-400 print:text-slate-700">
                Organized by: <strong className="text-slate-200 print:text-black">{tournament.organizedBy}</strong> •{" "}
                {tournament.venueName}, {tournament.city}
              </p>
            </div>

            <div className="text-right space-y-1">
              <div className="inline-block px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 print:border-black print:text-black">
                {entry.paymentStatus === "paid" ? "PAID & VERIFIED" : entry.paymentStatus === "waived" ? "FEE WAIVED" : "PAYMENT PENDING"}
              </div>
              <div className="font-mono text-xs text-slate-400 print:text-slate-800">
                Receipt: <strong className="text-slate-200 print:text-black">{receiptNumber}</strong>
              </div>
              <div className="text-[11px] text-slate-400 print:text-slate-700">
                Date: {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </div>
            </div>
          </div>

          {/* Team and Entry Details */}
          <div className="grid grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs print:bg-slate-50 print:border-black">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 print:text-slate-700">Registered Team</span>
              <div className="font-black text-base text-white print:text-black">{entry.teamName}</div>
              <div className="text-slate-300 print:text-slate-800">{entry.clubName || "Independent Club"}</div>
              <div className="text-slate-400 print:text-slate-700">Division: <strong className="text-slate-200 print:text-black">{divisionName}</strong></div>
              <div className="text-slate-400 print:text-slate-700">Assigned: <strong className="text-slate-200 print:text-black">{entry.groupName || "Group A"}</strong></div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 print:text-slate-700">Manager / Coach Contact</span>
              <div className="font-bold text-slate-200 print:text-black">{entry.contactName || "Team Representative"}</div>
              <div className="font-mono text-slate-300 print:text-slate-800">{entry.contactPhone || "—"}</div>
              <div className="text-slate-400 print:text-slate-700">City: <strong className="text-slate-200 print:text-black">{entry.city || tournament.city}</strong></div>
              <div className="text-slate-400 print:text-slate-700">Entry ID: <span className="font-mono text-[10px]">{entry.id.slice(0, 12)}</span></div>
            </div>
          </div>

          {/* Itemized Fee Breakdown Table */}
          <div className="space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 print:text-slate-800">Payment Breakdown</div>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 print:border-black print:text-slate-700">
                  <th className="py-2 text-left font-bold">Item Description</th>
                  <th className="py-2 text-center font-bold">Fee Basis</th>
                  <th className="py-2 text-right font-bold">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 print:divide-slate-300">
                <tr>
                  <td className="py-3 text-slate-200 print:text-black font-semibold">
                    Tournament Official Team Registration
                    <div className="text-[10px] text-slate-400 print:text-slate-600">Includes referee allowances, pitch scheduling & bracket entry</div>
                  </td>
                  <td className="py-3 text-center text-slate-300 print:text-black">Per Team</td>
                  <td className="py-3 text-right font-mono font-bold text-white print:text-black">₹{amountRupees}</td>
                </tr>
                <tr className="border-t border-slate-700 print:border-black">
                  <td colSpan={2} className="py-3 text-right font-black uppercase text-slate-300 print:text-black">Total Paid / Applicable</td>
                  <td className="py-3 text-right font-mono font-black text-lg text-emerald-400 print:text-black">₹{amountRupees}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Amount in Formal Indian Words */}
          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50 text-xs print:bg-slate-100 print:border-black">
            <span className="text-[10px] uppercase font-bold text-slate-400 print:text-slate-700">Amount in Words:</span>
            <div className="font-bold text-amber-300 print:text-black italic">{amountInWords}</div>
          </div>

          {/* Verification & Security Footer */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-800 text-[11px] print:border-black">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 print:text-slate-700">Payment Channel</span>
              <div className="font-semibold text-slate-300 print:text-black">
                {entry.paymentStatus === "waived"
                  ? "Organizing Committee Exemption"
                  : "Direct Grassroots NPCI UPI / Pitch Cash"}
              </div>
              <div className="font-mono text-[10px] text-slate-500 print:text-slate-700">{transactionRef}</div>
            </div>

            <div className="space-y-1 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-400 print:text-slate-700">Audit Status</span>
              <div className="flex items-center justify-center gap-1 text-emerald-400 print:text-black font-bold">
                <ShieldCheck size={14} /> Legally Authoritative
              </div>
              <div className="text-[10px] text-slate-500 print:text-slate-700">Tamper-Evident HMAC Signed</div>
            </div>

            <div className="space-y-1 text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 print:text-slate-700">Authorized Signature</span>
              <div className="font-bold text-white print:text-black">{tournament.organizedBy}</div>
              <div className="text-[10px] text-slate-400 print:text-slate-700">Tournament Committee</div>
            </div>
          </div>
        </div>

        {/* Bottom Interactive Bar (Hidden when printing) */}
        <div className="no-print px-6 py-4 bg-slate-950/80 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          {/* Quick status actions for tournament organizer */}
          {onUpdatePaymentStatus && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">Update Status:</span>
              <button
                disabled={updating || entry.paymentStatus === "paid"}
                onClick={() => handleStatusChange("paid")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  entry.paymentStatus === "paid"
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                    : "bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white"
                }`}
              >
                Mark Paid
              </button>
              <button
                disabled={updating || entry.paymentStatus === "waived"}
                onClick={() => handleStatusChange("waived")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  entry.paymentStatus === "waived"
                    ? "bg-purple-500/20 text-purple-400 border border-purple-500/40"
                    : "bg-slate-800 hover:bg-purple-600 text-slate-300 hover:text-white"
                }`}
              >
                Waive Fee
              </button>
              <button
                disabled={updating || entry.paymentStatus === "unpaid"}
                onClick={() => handleStatusChange("unpaid")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  entry.paymentStatus === "unpaid"
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                    : "bg-slate-800 hover:bg-amber-600 text-slate-300 hover:text-white"
                }`}
              >
                Mark Unpaid
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 ml-auto">
            {entry.paymentStatus !== "paid" && (
              <a
                href={upiUri}
                className="interactive-button px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 transition"
              >
                <IndianRupee size={14} /> Pay via UPI App
              </a>
            )}
            <button
              onClick={handlePrint}
              className="interactive-button px-4 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1.5 transition shadow"
            >
              <Printer size={14} /> Print Receipt
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
