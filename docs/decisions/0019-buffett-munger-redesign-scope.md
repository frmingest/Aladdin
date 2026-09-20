# 19. Buffett/Munger single-focus redesign — scope

## Status

Proposed. Recorded 2026-09-20 at Faiz's request for "a complete rework... to function as my Warren
Buffett/Charlie Munger advisor," built around a personal prompt template ("the Brain") he already
uses manually for single-stock/portfolio analysis. Sprint 0 (stabilization) and the first Sprint 1
foundation slice are built and committed as of this ADR (see Consequences); everything else below is
planned, not yet built. Full sprint-by-sprint detail lives in the companion project doc
`claude/buffett-munger-redesign-sprint-plan-2026-09-20.md` — this ADR records the scope decisions
that doc's sprints execute against, not the task list itself.

## Context

Faiz supplied "the Brain" — a five-step manual analyst prompt (business quality & moat; financial
fortress & debt; macro/industry stress test; intrinsic valuation & margin of safety; final verdict)
he runs by hand today, and asked for the application to be rebuilt around it end to end. Three
scope questions had to be resolved before any build sequencing made sense, and Faiz answered all
three explicitly before this ADR was written:

1. **Does the app keep its non-equity modules (whisky/collectibles, precious metals) alongside the
   new analysis engine, or does it narrow to stock/portfolio analysis only?** Faiz chose to narrow:
   "strip down to stock/portfolio analysis only... matches 'sole focus' language literally."
2. **The Brain asks for live investigation of current macro/geopolitical conditions (rates,
   inflation, a specific example: Iran/global energy and its read-through to a holding's price) —
   how does that square with §2.1/§11.2's evidence-first guardrail, which today treats the LLM's
   input as a closed packet built only from uploaded documents plus Phase 4's macro/sector
   research?** Faiz chose to extend the research layer with a new live-web-research capability
   carrying its own evidence/citation handling, rather than requiring him to keep supplying macro
   context as documents or doing that research manually outside the app.
3. **What should happen this session?** Faiz asked for the plan plus the start of Sprint 1's
   execution, not planning alone.

This ADR only needed writing at all because decision 1 reverses a standing feature (Phase 8,
ADR 0011) and decision 2 is a real architectural addition (a third grounded-research capability,
extending the pattern ADR 0007 established for macro/sector) — both are exactly the kind of
structural call §2.4/§28 say belongs in a recorded decision, not an in-place edit.

A fourth thing surfaced during this session's research, unprompted but directly relevant to scoping
correctly: **the persona/schema's current 3-factor model (business_quality/financial_strength/
valuation, `scoring/versions/v2.yaml`) is already a narrower collapse of architecture §13.1's
original 6-factor table** (business quality, financial strength, valuation, macro/rate sensitivity,
sector outlook, geopolitical exposure) — macro and geopolitical engagement were folded into a
checklist item inside `business_quality` (ECON-006, ADR 0014) rather than scored as their own
factors, because no regime/sector-outlook scoring existed yet at the time. The Brain's Step 1-4
structure maps far more directly onto the *original* 6-factor intent, extended further with
Buffett/Munger-specific sub-structure the architecture only described in prose (moat *rating*,
capital-efficiency hurdle, balance-sheet debt-service ratios, cyclicality, reverse DCF, a verdict).
This redesign is therefore also a return to already-approved-but-undelivered scope, not a wholesale
departure from the architecture document.

## Decisions

- **Scope narrows to equity/stock holdings.** `AssetClass.COMMODITY`/`AssetClass.COLLECTIBLE`
  (ADR 0011) and their supporting code (`gold_metal_provider.py`, whisky/coin composition UI,
  wealth-tax's alternative-asset handling) are descoped from the *analysis* surface — the
  Buffett/Munger persona was never meaningful for a whisky bottle or a gold coin, so this mostly
  formalizes an existing implicit boundary — and are staged for removal from the *portfolio/
  dashboard* surface in a later sprint (see the sprint-plan doc's Sprint 5), not deleted from the
  data model in this pass. Faiz's real portfolio holds these positions today; ripping out
  data-model support before confirming what "descope" means for his actual holdings (hide from the
  dashboard? stop pricing them? drop them entirely?) would be a destructive, unreviewed guess
  (§21) — the sprint plan surfaces this as an explicit checkpoint rather than deciding it here.
- **A new `ResearchProvider.get_company_research(holding)` capability**, extending exactly the
  pattern ADR 0007 already established for `get_macro_snapshot()`/`get_sector_research(sector)`:
  Gemini + Google Search grounding, source-attributed `ResearchItem`s, its own prompt
  (`prompts/research/company_v1.md`), its own `ResearchRunType`, cached per-holding on its own
  refresh interval (shorter than sector's — company-specific developments move faster than a whole
  sector's outlook), wired into `AnalysisContext` as a new citable `source_type="company_research"`
  evidence stream alongside macro/sector. This is what makes "investigate this company's specific
  industry, geography, and competitive environment" (the Brain's opening instruction, and its own
  Iran/energy example) a real per-holding capability instead of only-portfolio-wide macro plus
  generic-sector research. Same guardrails as every existing evidence source: grounded text is
  untrusted, cited by `evidence_id`, never presented as the model's own knowledge (§11.2).
- **The factor/schema model grows from 3 factors to the architecture's original 6**
  (`business_quality`, `financial_strength`, `valuation`, `macro_sensitivity`, `sector_outlook`,
  `geopolitical_exposure`), each still scored/confidence/reasoning by the LLM and blended by
  deterministic code exactly as today (§13.2 — this changes what's assessed, not who does the
  arithmetic), plus new sub-structure the Brain specifically asks for that the current schema has
  no field for at all:
  - a `moat` rating (Wide/Narrow/None) with named sub-dimensions (pricing power, switching costs,
    network effects, cost position, IP, distribution), separate from the general `business_quality`
    narrative;
  - a `capital_efficiency` view surfacing the new `average_over_periods`-blended 3-5yr ROIC/ROE/
    margin figures (deterministic, from this session's new `app.domain.calculations` primitives)
    against an explicit hurdle (cost of capital, or 15% where no better anchor exists);
  - a `balance_sheet_health` view surfacing Net Debt/EBITDA, Net Debt/FCF, interest coverage, D/E
    (also deterministic, using this session's new `free_cash_flow` primitive and the existing
    generic `ratio()`/`net_debt()` functions once the four new canonical metrics are populated by
    extraction);
  - explicit `cyclicality` and `reverse_dcf` fields (Step 3.4 and Step 4.3 of the Brain);
  - a `verdict` field (Strong Buy/Buy/Hold/Sell/Avoid) and a `price_target` range, framed exactly
    like the existing persona's valuation guardrail (a range with explicit uncertainty, never a
    single fabricated number presented as fact) and exactly like §25's non-goal ("provide automated
    financial advice") — this is decision-support labeled as Faiz's own call, the same framing the
    persona prompt already uses for itself ("not a licensed financial adviser... decision-support
    analysis for someone who will make their own decisions"), not a change to that boundary.
  This is a new schema version (`schemas/versions/analysis_output_v2.json`), a new persona
  (`prompts/persona/v4.md`), a new synthesis prompt, and a new scoring version
  (`scoring/versions/v3.yaml`) with regime-conditional weights across all 6 factors — never an
  in-place edit of v3/v2/v2 (§2.4), so every existing `analysis_runs` row stays interpretable
  against the versions that actually produced it.

## Consequences

- **Built and committed this session** (Sprint 0 + first Sprint 1 slice — see git log): a
  `.gitattributes`/renormalize fix for 61 files of pure CRLF line-ending noise that had been sitting
  uncommitted; removal of two already-confirmed-dead files (`runner-1.py`, an unused CSS file); the
  live reconciliation-pass bug fix (missing `prompts/synthesis/v3.md`, diagnosed in
  `claude/architecture-redundancy-review-2026-09-16.md`); and two new deterministic primitives
  (`free_cash_flow`, `average_over_periods`) plus four new extractable canonical metrics
  (`total_debt`, `cash_and_equivalents`, `capital_expenditures`, `interest_expense`) that the new
  `balance_sheet_health`/`capital_efficiency` views above will read from once built.
- **Not built yet**: the new research capability, the v4 persona/v2 schema/v3 scoring rewrite, the
  non-equity descope itself, reverse DCF, and the dashboard/UI rework to surface any of this — all
  sequenced in the companion sprint-plan doc.
- **This redesign cannot be quality-verified against a live LLM call yet.** Both configured
  providers (Gemini primary, Mistral fallback) are currently 429ing on every call in production
  (`claude/mistral-fallback-still-429-2026-09-17.md`); the local-Ollama migration (ADR 0017) is
  built but not enabled pending Faiz's own quality bake-off. Every new prompt/schema change in this
  redesign is verifiable by unit/integration test (schema validation, deterministic-calculation
  correctness, mocked-provider wiring) but not by an actual model run's *quality* until one of these
  is resolved — flagged explicitly rather than silently assumed fine.
- **Non-goal boundary unchanged**: adding a `verdict` field does not move this system across §25's
  "will not... provide automated financial advice" line. It is Faiz's own decision-support tool,
  reviewed and run by him; the verdict is the persona's structured opinion, not an instruction the
  application acts on (§25's other non-goal, "will not execute trades," is untouched — nothing
  downstream of an analysis run gains any new ability to act on its output through this redesign).
