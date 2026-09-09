"use client";

import React, { useRef, useState } from "react";
import { Download, Share2, Sparkles, Trophy, Check, Smartphone } from "lucide-react";
import { SafeText, getTeamTricode } from "../ui/SafeText";
import { IndicCanvasRenderer } from "../../lib/indic-canvas";

export interface WhatsAppScorecardProps {
  tournamentName: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  homeScorers?: string[];
  awayScorers?: string[];
  playerOfTheMatch?: string;
  dateText?: string;
  venueText?: string;
}

export function WhatsAppScorecardCard({
  tournamentName,
  homeTeamName,
  awayTeamName,
  homeScore,
  awayScore,
  homeScorers = [],
  awayScorers = [],
  playerOfTheMatch,
  dateText = "Matchday Result",
  venueText = "Indian Grassroots Arena",
}: WhatsAppScorecardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [shared, setShared] = useState(false);

  const generateCanvas = (): HTMLCanvasElement => {
    const canvas = canvasRef.current || document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext("2d");
    if (!ctx) return canvas;

    // 1. Dark Stadium Gradient Background
    const bgGrad = ctx.createLinearGradient(0, 0, 1080, 1350);
    bgGrad.addColorStop(0, "#090d16");
    bgGrad.addColorStop(0.5, "#0e1726");
    bgGrad.addColorStop(1, "#05070a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1080, 1350);

    // 2. Bharat Saffron & Emerald Accent Beams
    const glowGrad1 = ctx.createRadialGradient(150, 150, 0, 150, 150, 400);
    glowGrad1.addColorStop(0, "rgba(245, 158, 11, 0.25)");
    glowGrad1.addColorStop(1, "rgba(245, 158, 11, 0)");
    ctx.fillStyle = glowGrad1;
    ctx.fillRect(0, 0, 1080, 1350);

    const glowGrad2 = ctx.createRadialGradient(930, 1200, 0, 930, 1200, 450);
    glowGrad2.addColorStop(0, "rgba(16, 185, 129, 0.2)");
    glowGrad2.addColorStop(1, "rgba(16, 185, 129, 0)");
    ctx.fillStyle = glowGrad2;
    ctx.fillRect(0, 0, 1080, 1350);

    // 3. Top Header: Bharat Brand Pill
    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    ctx.beginPath();
    ctx.roundRect(340, 60, 400, 60, 30);
    ctx.fill();
    ctx.strokeStyle = "rgba(245, 158, 11, 0.4)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 26px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("🇮🇳 MYFOOTBALL BHARAT", 540, 100);

    // 4. Tournament Title (Grapheme-safe truncate)
    ctx.fillStyle = "#f59e0b";
    ctx.font = "bold 44px sans-serif";
    const truncatedTourney = IndicCanvasRenderer.truncateGraphemes(tournamentName.toUpperCase(), 32);
    ctx.fillText(truncatedTourney, 540, 190);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "500 24px sans-serif";
    ctx.fillText(`${dateText} • ${venueText}`, 540, 235);

    // 5. Team Badges & Score Box
    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.beginPath();
    ctx.roundRect(80, 290, 920, 420, 40);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Home Team Tricode Box
    ctx.fillStyle = "#f59e0b";
    ctx.beginPath();
    ctx.roundRect(140, 350, 120, 120, 24);
    ctx.fill();
    ctx.fillStyle = "#090d16";
    ctx.font = "900 50px sans-serif";
    ctx.fillText(getTeamTricode(homeTeamName), 200, 425);

    // Home Team Name (Grapheme-safe)
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 36px sans-serif";
    ctx.textAlign = "center";
    const safeHomeName = IndicCanvasRenderer.truncateGraphemes(homeTeamName, 18);
    ctx.fillText(safeHomeName, 200, 520);

    // Score in Center
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 130px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${homeScore}  -  ${awayScore}`, 540, 495);

    ctx.fillStyle = "#10b981";
    ctx.font = "bold 26px sans-serif";
    ctx.fillText("FULL TIME OFFICIAL", 540, 570);

    // Away Team Tricode Box
    ctx.fillStyle = "#10b981";
    ctx.beginPath();
    ctx.roundRect(820, 350, 120, 120, 24);
    ctx.fill();
    ctx.fillStyle = "#090d16";
    ctx.font = "900 50px sans-serif";
    ctx.fillText(getTeamTricode(awayTeamName), 880, 425);

    // Away Team Name (Grapheme-safe)
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 36px sans-serif";
    ctx.textAlign = "center";
    const safeAwayName = IndicCanvasRenderer.truncateGraphemes(awayTeamName, 18);
    ctx.fillText(safeAwayName, 880, 520);

    // 6. Match Scorers Section (Indic Word-Wrapped & Grapheme Safe)
    ctx.fillStyle = "rgba(30, 41, 59, 0.7)";
    ctx.beginPath();
    ctx.roundRect(80, 750, 920, 290, 30);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.stroke();

    ctx.fillStyle = "#f59e0b";
    ctx.font = "bold 24px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("⚽ MATCH GOALSCORERS", 120, 795);

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "500 24px sans-serif";

    // Home Scorers with Grapheme wrapping
    const homeScorerText = `${getTeamTricode(homeTeamName)}: ${homeScorers.length > 0 ? homeScorers.join(", ") : "No goals"}`;
    const wrappedHome = IndicCanvasRenderer.wrapIndicText(ctx, homeScorerText, {
      maxWidth: 840,
      fontSize: 24,
      maxLines: 2,
      lineHeightMultiplier: 1.45,
    });

    let currentY = 840;
    for (const line of wrappedHome.lines) {
      ctx.fillText(line.text, 120, currentY);
      currentY += 32;
    }

    // Away Scorers with Grapheme wrapping
    const awayScorerText = `${getTeamTricode(awayTeamName)}: ${awayScorers.length > 0 ? awayScorers.join(", ") : "No goals"}`;
    const wrappedAway = IndicCanvasRenderer.wrapIndicText(ctx, awayScorerText, {
      maxWidth: 840,
      fontSize: 24,
      maxLines: 2,
      lineHeightMultiplier: 1.45,
    });

    currentY = Math.max(currentY + 8, 915);
    for (const line of wrappedAway.lines) {
      ctx.fillText(line.text, 120, currentY);
      currentY += 32;
    }

    if (playerOfTheMatch) {
      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 24px sans-serif";
      const safePotm = IndicCanvasRenderer.truncateGraphemes(playerOfTheMatch, 25);
      ctx.fillText(`⭐ PLAYER OF THE MATCH: ${safePotm}`, 120, Math.min(currentY + 12, 1010));
    }

    // 7. Footer Call to Action
    ctx.fillStyle = "#64748b";
    ctx.font = "500 22px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Verified on myfootball.in • Indian Football Digital Operating System", 540, 1280);

    return canvas;
  };

  const handleDownload = () => {
    setDownloading(true);
    try {
      const canvas = generateCanvas();
      const link = document.createElement("a");
      link.download = `myfootball-${getTeamTricode(homeTeamName)}-vs-${getTeamTricode(awayTeamName)}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (e) {
      console.error(e);
    } finally {
      setDownloading(false);
    }
  };

  const handleWhatsAppShare = async () => {
    const shareText = `🏆 *${tournamentName}* Match Result!\n⚽ *${homeTeamName} ${homeScore} - ${awayScore} ${awayTeamName}*\n\nView official match sheets & standings on MyFootball Bharat: https://myfootball.in`;

    // Attempt Web Share API Level 2 (files support)
    const canvas = generateCanvas();
    if (typeof navigator !== "undefined" && typeof navigator.share === "function" && typeof navigator.canShare === "function" && canvas.toBlob) {
      try {
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/png")
        );
        if (blob) {
          const file = new File(
            [blob],
            `match-${getTeamTricode(homeTeamName)}-vs-${getTeamTricode(awayTeamName)}.png`,
            { type: "image/png" }
          );
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: `${tournamentName} Scorecard`,
              text: shareText,
              files: [file],
            });
            setShared(true);
            setTimeout(() => setShared(false), 3000);
            return;
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
      }
    }

    // Universal WhatsApp deep link fallback
    const encoded = encodeURIComponent(shareText);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, "_blank");
    setShared(true);
    setTimeout(() => setShared(false), 3000);
  };

  return (
    <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
            <Smartphone size={18} />
          </div>
          <div>
            <h4 className="text-sm font-black text-white">WhatsApp & Story Poster</h4>
            <p className="text-[11px] text-slate-400">Indic-safe high-res match card with 1-tap WhatsApp Share</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="interactive-button flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center justify-center gap-2 transition"
        >
          <Download size={14} className="text-amber-400" />
          {downloading ? "Rendering PNG..." : "Download Poster (HD)"}
        </button>

        <button
          onClick={handleWhatsAppShare}
          className="interactive-button flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-600/20"
        >
          {shared ? <Check size={14} /> : <Share2 size={14} />}
          {shared ? "Shared!" : "Share on WhatsApp / Story"}
        </button>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
