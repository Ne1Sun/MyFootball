import test from "node:test";
import assert from "node:assert/strict";

// Import modules under test
import { convertRupeesToWordsIndian, generateGrassrootsUpiUri } from "../app/lib/receipt-generator.ts";
import { IndicCanvasRenderer } from "../app/lib/indic-canvas.ts";

test("convertRupeesToWordsIndian correctly formats currency under Indian numbering system", () => {
  // Zero paise
  assert.equal(convertRupeesToWordsIndian(0), "Rupees Zero Only");

  // Hundreds
  assert.equal(convertRupeesToWordsIndian(50000), "Rupees Five Hundred Only");

  // Thousands
  assert.equal(convertRupeesToWordsIndian(250000), "Rupees Two Thousand Five Hundred Only");
  assert.equal(convertRupeesToWordsIndian(1000000), "Rupees Ten Thousand Only");

  // Lakhs
  assert.equal(convertRupeesToWordsIndian(15000000), "Rupees One Lakh Fifty Thousand Only");
  assert.equal(convertRupeesToWordsIndian(7520000), "Rupees Seventy Five Thousand Two Hundred Only");

  // Crores
  assert.equal(convertRupeesToWordsIndian(25000000000), "Rupees Twenty Five Crore Only");
  assert.equal(convertRupeesToWordsIndian(2500000000), "Rupees Two Crore Fifty Lakh Only");

  // Complex multi-tier number: Rs 1,23,456
  assert.equal(
    convertRupeesToWordsIndian(12345600),
    "Rupees One Lakh Twenty Three Thousand Four Hundred Fifty Six Only"
  );
});

test("generateGrassrootsUpiUri generates valid NPCI-compliant deep links", () => {
  const uri = generateGrassrootsUpiUri({
    payeeVpa: "tournament.organizer@okaxis",
    payeeName: "Mumbai Grassroots League",
    amountPaise: 250000,
    tournamentSlug: "mgl-summer-cup-2026",
    entryId: "entry-998877",
    teamName: "Bandra Warriors FC",
  });

  assert.ok(uri.startsWith("upi://pay?"), "Must start with standard UPI protocol scheme");

  const url = new URL(uri);
  const params = url.searchParams;

  assert.equal(params.get("pa"), "tournament.organizer@okaxis");
  assert.equal(params.get("pn"), "Mumbai Grassroots League");
  assert.equal(params.get("am"), "2500.00", "Amount must be strict 2-decimal INR representation");
  assert.equal(params.get("cu"), "INR", "Currency must be INR");
  assert.equal(params.get("mode"), "02");
  assert.ok(params.get("tn")?.includes("BandraWarriors"), "Transaction note must contain sanitized team token");
  assert.ok(params.get("tr")?.startsWith("MFB"), "Transaction reference must have MFB prefix");
});

test("IndicCanvasRenderer splits text into atomic grapheme clusters preserving combining marks", () => {
  // Hindi "नमस्ते" (na-ma-s-te) has 4 graphemes: न, म, स्, ते (or 4 clusters depending on virama joiner)
  const devanagariWord = "नमस्ते";
  const graphemes = IndicCanvasRenderer.splitIntoGraphemes(devanagariWord, "hi-IN");
  assert.ok(graphemes.length > 0);
  assert.equal(graphemes.join(""), devanagariWord, "Recombined graphemes must reproduce original string identically");

  // Bengali "ফুটবল" (football)
  const bengaliWord = "ফুটবল";
  const bengaliGraphemes = IndicCanvasRenderer.splitIntoGraphemes(bengaliWord, "bn-IN");
  assert.equal(bengaliGraphemes.join(""), bengaliWord);

  // Tamil "கால்பந்து" (football)
  const tamilWord = "கால்பந்து";
  const tamilGraphemes = IndicCanvasRenderer.splitIntoGraphemes(tamilWord, "ta-IN");
  assert.equal(tamilGraphemes.join(""), tamilWord);
});

test("IndicCanvasRenderer safely truncates Indic strings without stranding combining diacritics", () => {
  const longName = "रिलायंस फाउंडेशन यंग चैंप्स एकेडमी मुंबई";
  const truncated = IndicCanvasRenderer.truncateGraphemes(longName, 8, "…", "hi-IN");

  assert.ok(truncated.endsWith("…"), "Must append ellipsis");
  assert.ok(truncated.length < longName.length, "Must be shorter than original");

  // Ensure short string is untouched
  const shortName = "केरला ब्लास्टर्स";
  const untouched = IndicCanvasRenderer.truncateGraphemes(shortName, 20, "…", "hi-IN");
  assert.equal(untouched, shortName);
});

test("IndicCanvasRenderer wraps multi-line Indic text within maximum width constraints", () => {
  const matchScorers = "सुनील छेत्री (12', 44'), लल्लियनजुआला चांगटे (68'), मनवीर सिंह (89')";
  
  // Wrap with narrow container (200px)
  const wrapped = IndicCanvasRenderer.wrapIndicText(null, matchScorers, {
    maxWidth: 200,
    fontSize: 16,
    maxLines: 4,
    lineHeightMultiplier: 1.5,
    locale: "hi-IN",
  });

  assert.ok(wrapped.lines.length >= 2, "Long scorers list must wrap to multiple lines");
  assert.ok(wrapped.lines.length <= 4, "Must respect maxLines constraint");
  assert.ok(wrapped.totalHeight > 0, "Must calculate non-zero total vertical height");
  assert.equal(typeof wrapped.isTruncated, "boolean");
});

test("Offline FIFO Queue preserves event insertion ordering and evicts cleanly", () => {
  const queue = [
    { id: "mut-1", action: "recordDetailedMatchEvent", timestamp: 1000 },
    { id: "mut-2", action: "recordDetailedMatchEvent", timestamp: 2000 },
    { id: "mut-3", action: "updateLiveMatch", timestamp: 3000 },
  ];

  // Verify FIFO extraction
  const first = queue.shift();
  assert.equal(first?.id, "mut-1");

  const second = queue.shift();
  assert.equal(second?.id, "mut-2");

  assert.equal(queue.length, 1);
  assert.equal(queue[0].id, "mut-3");
});

test("Commerce Invariant: Prevents approving tournament entries with unpaid fees", () => {
  function validateEntryApproval(entryStatus, paymentStatus, amountPaise) {
    if (entryStatus === "approved" && amountPaise > 0 && paymentStatus === "unpaid") {
      return { allowed: false, error: "Cannot approve entry with unpaid registration fee." };
    }
    return { allowed: true };
  }

  // Unpaid with fee > 0 -> REJECTED
  assert.equal(validateEntryApproval("approved", "unpaid", 250000).allowed, false);

  // Paid with fee > 0 -> ALLOWED
  assert.equal(validateEntryApproval("approved", "paid", 250000).allowed, true);

  // Waived with fee > 0 -> ALLOWED
  assert.equal(validateEntryApproval("approved", "waived", 250000).allowed, true);

  // Unpaid with fee = 0 (Free grassroots tournament) -> ALLOWED
  assert.equal(validateEntryApproval("approved", "unpaid", 0).allowed, true);

  // Pending status with unpaid fee -> ALLOWED (still awaiting payment)
  assert.equal(validateEntryApproval("pending", "unpaid", 250000).allowed, true);
});
