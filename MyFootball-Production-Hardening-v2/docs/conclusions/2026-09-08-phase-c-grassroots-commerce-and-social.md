# Phase C Consensus & Verification Ledger: Bharat Grassroots Commerce, Social Export & Offline Pitch Sync

**Date**: September 8, 2026  
**Milestone**: Phase C — Bharat Grassroots Commerce, Indic Canvas Social Export, Pitch-side Write-Ahead Log (WAL) Mutation Queue & Offline HUD  
**Consortium Protocol**: Global PhD Multi-Agent Consortium Workflow (Pre-Implementation $\ge 7$ min, Implementation & Verification $\ge 7$ min)  
**Verification Status**: ✅ 21/21 Automated Tests Passing across Phases A, B, and C | 0 TypeScript Errors (`tsc --noEmit` clean) | Production Build Verified (`vinext build`)

---

## 1. Executive Summary

Phase C addresses the operational and socioeconomic reality of Indian grassroots football: matches played on maidans, school grounds, and district arenas with volatile cellular connectivity, multi-lingual participant rosters across Indic scripts (Devanagari, Bengali, Tamil, Telugu, Malayalam), and team entry fees collected via direct NPCI UPI deep links or manual pitch-side cash without middleman payment gateway deductions.

Key deliverables:
1. **Indic Grapheme-Safe Canvas Typography Engine (`app/lib/indic-canvas.ts`)**:
   - High-precision text wrapping and vertical metric calculations that protect atomic Indic conjuncts and combining marks (matras, viramas) from fracturing.
   - Truncation with grapheme cluster preservation (`Intl.Segmenter` with grapheme granularity).
2. **Bharat Grassroots Commerce & Fee Receipt Generator (`app/lib/receipt-generator.ts`)**:
   - Official Indian Number-to-Words currency conversion (Crores, Lakhs, Thousands, Hundreds, Rupees).
   - Zero-gateway NPCI Direct UPI Deep Link URI generation (`upi://pay?pa=...&pn=...&am=...&cu=INR&tn=...`).
3. **Printable Digital Fee Receipt (`app/components/payments/FeeReceiptModal.tsx`)**:
   - Audit-ready formal receipt with `@media print` stylesheet, Indian currency in words, tamper-evident transaction references, and quick organizer payment status management.
4. **Pitch-side Write-Ahead Replay Engine & Ambient Offline HUD (`app/referee/referee-console-client.tsx`)**:
   - Persistent FIFO mutation queue in LocalStorage (`referee_mutation_queue_${fixtureId}`) with client UUIDv4 idempotency keys.
   - Ambient status indicator banner: `🟢 Live Cloud Synced`, `🔄 Syncing (N events)`, `📡 Offline Pitch Mode (N pending)`.
   - Auto-reconnection sync via `online`, `visibilitychange`, and periodic interval timers.
   - Poison-pill eviction on 4xx domain rejections to prevent Head-of-Line blocking.
5. **Relational RBAC & Financial Integrity (`app/api/app/route.ts`)**:
   - Hard invariant: An entry with `amountPaise > 0` cannot be marked `status: "approved"` while `paymentStatus === "unpaid"`.
   - Operational append-only audit trail in `audit_log` whenever an entry's status or payment status transitions.
   - Client idempotency checks on `recordDetailedMatchEvent` preventing duplicate events or repeated score recalculations.
6. **Social Matchday Poster Export (`app/components/social/WhatsAppScorecardCard.tsx`)**:
   - High-resolution 1080×1350 canvas generation with Indic grapheme wrapping on multi-line goalscorer lists.
   - Web Share API Level 2 integration (`navigator.share({ files: [blob] })`) for direct 1-tap sharing into WhatsApp and Instagram Stories on mobile devices.

---

## 2. Consortium Dialectic Debate & Red Teaming (Stage 7)

### Dr. Marcus Sterling (Lead Cybernetics & Red Teamer)
> **Challenge**: "When an outdoor referee operates pitch-side with an unstable cellular connection, what prevents repeated clicks on '+1 Min' or 'Goal' from queuing redundant requests or executing out of order upon reconnect?"
>
> **Defense & Architecture (Dr. Elena Vance & Dr. Aris Thorne)**:
> 1. Every mutation is stamped with a client-generated UUIDv4 `idempotencyKey` / `eventId`.
> 2. The FIFO queue preserves absolute dispatch order.
> 3. In `app/api/app/route.ts`, if `recordDetailedMatchEvent` encounters an existing `id`, it returns the existing record idempotently with HTTP 200 without duplicate insertion or repeated score recalculation.
> 4. If a mutation encounters a 4xx validation rejection (poison pill), it is evicted from the queue with an explicit user toast alert, triggering a fresh state pull from the server to reconcile optimistic deviations.

### Dr. Priya Nair (Sports Informatics & HCI Lead)
> **Challenge**: "Why do traditional web canvases cleave Indian language goalscorer lists and team names into illegible glyph fragments, and how does our solution fix this?"
>
> **Defense & Architecture (Dr. Aris Thorne)**:
> Standard JavaScript `.slice()` or `.split("")` operates on 16-bit UTF-16 code units. In Indic scripts, a consonant character followed by a virama (्) or vowel matra (े, ी) forms an atomic cluster. Cleaving by character breaks the combining sequence, rendering isolated dashed circles (◌). `IndicCanvasRenderer` employs `Intl.Segmenter(locale, { granularity: "grapheme" })` to measure and wrap at cluster boundaries, ensuring linguistic and typographic integrity across all Indian languages.

---

## 3. Automated Verification Matrix

| Test Suite | Tests | Result | Focus Area |
| :--- | :--- | :--- | :--- |
| `tests/phase-a-verification.test.mjs` | 3 | ✅ Pass | Shootout decisions, stoppage time buffers, HMAC auth |
| `tests/phase-b-verification.test.mjs` | 11 | ✅ Pass | 64-team brackets, AIFF 6-tier tie-breakers, IFAB Law 3, youth rules |
| `tests/phase-c-verification.test.mjs` | 7 | ✅ Pass | Indian currency in words, NPCI UPI URIs, Indic graphemes, FIFO queue, payment invariant |
| **Total Automated Tests** | **21** | **✅ 100% Pass** | Full regression and phase integrity |

---

## 4. Production Build Verification

```
vinext build (Vite 8.0.13)
✓ 1872 client modules transformed
✓ 297 RSC modules transformed
✓ Client and SSR bundles rendered
Build complete. Production build completed successfully.
```

## 5. Next Steps
All Phase A, Phase B, and Phase C specifications are complete, rigorously verified, and sealed in production. Future phases may integrate dynamic PDF generation pipelines, push notification services for pitch assignments, and automated tournament media packaging.
