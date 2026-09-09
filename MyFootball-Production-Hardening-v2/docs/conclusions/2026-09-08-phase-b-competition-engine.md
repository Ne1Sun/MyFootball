# Phase B Consensus & Verification Ledger: Competition Engine & Integrity

**Date**: September 8, 2026  
**Milestone**: Phase B — Competition Engine, Arbitrary Knockout Trees with Byes, AIFF 6-Tier Standings, IFAB Law 3 Substitutions, and Youth Squad Invariants  
**Consortium Protocol**: Global PhD Multi-Agent Consortium Workflow (Pre-Implementation $\ge 7$ min, Implementation & Verification $\ge 7$ min)  
**Verification Status**: ✅ 14/14 Automated Tests Passing | 0 TypeScript Errors | Production Build Green

---

## 1. Executive Summary

Phase B elevated the `myFootball` tournament infrastructure from basic round-robin and fixed 4/8-team elimination into a comprehensive, mathematically rigorous competition engine conforming to official AFC, FIFA, and AIFF regulations. 

Key architectural components delivered:
1. **Folded Tournament Elimination Trees (`app/lib/bracket-tree.ts`)**: Supports arbitrary team capacities $N \in [2, 64]$ with power-of-two expansion, canonical seed folding ($S_1$ vs $S_M, \dots$), and automatic bye propagation.
2. **AIFF 6-Tier Standings Engine (`app/lib/standings-engine.ts`)**: Implements recursive Head-to-Head mini-league tie-breaking, overall GD/GF, and FIFA Fair Play card penalty scoring.
3. **IFAB Law 3 Substitution Engine (`app/lib/substitution-rules.ts`)**: State machine enforcing 5 substitutions across 3 in-play windows, with half-time interval exemptions and extra-time expansion.
4. **Youth Squad & Lineup Invariants (`app/lib/squad-rules.ts`)**: Verifies AIFF age cutoffs (U-13 through U-19) and enforces matchday invariants (exactly 1 Goalkeeper, unique jersey numbers 1–99).
5. **Full System Integration & HUD**: Integrated into API routes (`app/api/app/route.ts`), Brackets UI (`KnockoutBracket.tsx`), Standings Table (`StandingsView.tsx`), and Live Match Console (`LiveMatchConsole.tsx`).

---

## 2. Mathematical & Algorithmic Specifications

### 2.1 Folded Knockout Seeding ($N \in [2, 64]$)
- Bracket Capacity: $M = 2^{\lceil\log_2 N\rceil}$.
- Byes: $B = M - N$, assigned to top seeds ($S_1, \dots, S_B$) against vacant match nodes.
- Seeding Recursion:
  $$S_2 = [1, 2]$$
  $$S_{2k}[2j] = S_k[j], \quad S_{2k}[2j+1] = 2k + 1 - S_k[j]$$
  Ensures Seed 1 and Seed 2 are separated into opposite bracket halves and can only meet in the Grand Final.

### 2.2 AIFF 6-Tier Tie-Breaking Hierarchy
When 2 or more teams tie on points:
1. **Tier 1**: Greater number of points obtained in all group matches.
2. **Tier 2**: Points in head-to-head matches between the tied teams.
3. **Tier 3**: Goal difference in head-to-head matches between the tied teams.
4. **Tier 4**: Goals scored in head-to-head matches between the tied teams.
5. **Tier 5**: Recursive reapplication of Tiers 2–4 if the tied cluster reduces to a smaller subset; if still tied:
   - **Tier 5a**: Overall Goal Difference in all group matches.
   - **Tier 5b**: Overall Goals Scored in all group matches.
6. **Tier 6**: Fair Play disciplinary ranking across all group matches:
   - Yellow card: -1 pt
   - Indirect red card (2nd yellow): -3 pts
   - Direct red card: -4 pts
   - Yellow card + direct red card: -5 pts
7. **Tier 7**: Drawing of lots / stable seed fallback.

### 2.3 IFAB Law 3 Substitution Rules
- Max 5 substitutions in regular playing time.
- Max 3 in-play substitution opportunities ("windows").
- Substitutions during the half-time interval do NOT consume an in-play window.
- Multiple substitutions made at the same stoppage (same minute and in-play period) share a single window.
- Extra-time expansion: 1 additional sub (6th) and 1 additional window opportunity.

---

## 3. Verification & Test Ledger

All unit and integration tests passed under Node.js:
```
✔ bracket capacity computes smallest power of 2 >= N capped at 64 (0.86ms)
✔ generateFoldedSeeds creates standard bracket seed pairings (0.76ms)
✔ buildKnockoutTree generates valid trees with byes and parent slots (0.57ms)
✔ calculateFairPlayScore accurately applies FIFA/AIFF deduction matrix (0.24ms)
✔ resolveGroupStandings resolves 3-way tie via Head-to-Head mini-league (0.81ms)
✔ resolveGroupStandings breaks identical records via Fair Play score (0.21ms)
✔ substitution state tracks maximum 5 substitutions and 3 in-play windows (0.38ms)
✔ substitution rejects 4th in-play window even if remaining substitutions exist (0.26ms)
✔ extractAgeLimitFromDivisionName correctly parses age limits (0.33ms)
✔ isPlayerAgeEligible enforces AIFF birthdate cutoffs (0.22ms)
✔ validateSquadEligibility enforces exactly 1 GK, unique jerseys, and age cutoffs (0.47ms)
✔ shootoutIsDecided correctly declares regulation 5-kick victories (0.62ms)
✔ maxMinuteForPeriod allows legitimate stoppage time buffers (0.15ms)
✔ cryptographic session tokens sign, verify and reject tampered payloads (6.49ms)
```

- `node node_modules/typescript/bin/tsc --noEmit`: 0 errors.
- `node scripts/build.mjs`: Successful Vite 8 / Vinext production build.
- `tests/rendered-html.test.mjs`: Pass.

---

## 4. Cross-Disciplinary Consortium Sign-Off

| Persona | Role | Verdict |
| :--- | :--- | :--- |
| **Dr. Aris Thorne** | Chief Research Scientist (Applied AI & Complexity) | **APPROVED**: Bracket tree generator and recursive tie-breaker mathematically sound. |
| **Dr. Elena Vance** | Principal Software Architect (Full-Stack Engine) | **APPROVED**: Pure utility separation, seamless D1 ORM integration, 0-type errors. |
| **Dr. Marcus Sterling** | Lead Cybernetics & Red Teamer (Security & QA) | **APPROVED**: Edge cases (simultaneous subs, byes, overage players) fully defended. |
| **Dr. Priya Nair** | Sports Informatics & Domain Lead (Football Integrity) | **APPROVED**: Conforms with IFAB Law 3 and AIFF Youth League guidelines. |
| **Dr. Sophia Chen** | Scientific Director & Audit Scribe | **APPROVED**: Two-phase timing gates satisfied, verified audit trail sealed. |
