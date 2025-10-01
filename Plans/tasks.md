# Sleeper MCP Server - Development Tasks

## 🔥 Immediate Priority (In Progress)

### 1. Create get_league_roster Tool
**Status:** In Progress
**Goal:** Enable detailed roster view for a specific league with starters, bench, and player status

- [ ] Add tool definition to index.ts ListToolsRequestSchema handler
- [ ] Add tool execution case to CallToolRequestSchema handler
- [ ] Implement getLeagueRoster method in SleeperTools class
- [ ] Test the new tool with example queries

**Expected Output:**
- League name and basic info
- User's roster with starters clearly marked
- Bench players listed separately
- Player status (Active, IR, Injured, etc.)
- Team assignments for each player

---

## 📋 Phase 1: Core Functionality Gaps (Week 1-2)

### 2. Waiver Wire Intelligence Tool
**Priority:** High
**Impact:** Directly addresses 3-hour → 1-hour time savings goal

- [ ] Create `get_waiver_targets` tool
- [ ] Fetch available players across all leagues
- [ ] Cross-reference with roster needs from multi-roster analysis
- [ ] Prioritize players available in multiple leagues
- [ ] Consider league scoring settings (PPR vs standard)
- [ ] Format recommendations by position and league

### 3. Current Week Optimization Tool
**Priority:** High
**Impact:** Weekly time-saver for lineup decisions

- [ ] Create `get_weekly_lineup_recommendations` tool
- [ ] Combine matchup analysis with roster depth
- [ ] Identify sit/start decisions across all leagues
- [ ] Flag injury concerns affecting multiple teams
- [ ] Prioritize decisions by league competitiveness

### 4. Improve Tool Descriptions
**Priority:** Medium
**Impact:** Better Claude tool selection

- [ ] Update `get_league_info` description to clarify it doesn't show individual rosters
- [ ] Update `get_multi_roster_analysis` description to mention it answers roster/player queries
- [ ] Add usage examples to tool descriptions where helpful

---

## 📊 Phase 2: Advanced Analysis (Week 3-4)

### 5. Trade Analysis Tool
**Priority:** High
**Impact:** Most requested feature in fantasy football tools

- [ ] Create `analyze_trade` tool
- [ ] Accept proposed trade parameters (giving/receiving players)
- [ ] Compare player values using recent performance data
- [ ] Consider roster needs from existing analysis
- [ ] Account for league-specific scoring multipliers
- [ ] Provide "fair value" assessment

### 6. Performance Trends Tool
**Priority:** Medium
**Impact:** Proactive player management

- [ ] Create `get_player_trends` tool
- [ ] Track player performance over recent weeks (last 3-5 games)
- [ ] Identify emerging breakout candidates
- [ ] Flag declining players ("sell high" opportunities)
- [ ] Cross-reference with user rosters across all leagues

### 7. League Settings Comparison
**Priority:** Medium
**Impact:** Better cross-league decision making

- [ ] Create `compare_league_settings` tool
- [ ] Compare scoring across all user leagues
- [ ] Show how same player values differently in different formats
- [ ] Identify PPR vs standard scoring differences
- [ ] Help prioritize waiver claims based on league scoring

---

## 🎯 Phase 3: Playoff & Strategy (Week 5-6)

### 8. Playoff Probability Calculator
**Priority:** Medium
**Impact:** Better time allocation across leagues

- [ ] Create `get_playoff_chances` tool
- [ ] Calculate playoff probability based on current standings
- [ ] Identify must-win weeks for each league
- [ ] Prioritize attention on leagues with playoff implications
- [ ] Show tiebreaker scenarios

### 9. Season-Long Performance Dashboard
**Priority:** Low
**Impact:** Big picture insights

- [ ] Create `get_season_summary` tool
- [ ] Overall record across all leagues
- [ ] Best/worst performing teams
- [ ] Total points scored across all rosters
- [ ] Key achievements and milestones

---

## 🛠️ Phase 4: Infrastructure & Quality (Ongoing)

### 10. Error Recovery & Resilience
**Priority:** Medium
**Impact:** Production reliability

- [ ] Implement partial failure handling (some leagues succeed, others fail)
- [ ] Add retry logic for transient API failures
- [ ] Improve error messages with actionable guidance
- [ ] Add timeout handling for slow API responses

### 11. Testing Framework
**Priority:** Medium
**Impact:** Development confidence

- [ ] Set up testing framework (Jest or similar)
- [ ] Add unit tests for business logic in tools.ts
- [ ] Add integration tests with mocked Sleeper API
- [ ] Add tests for caching behavior
- [ ] Add tests for player cache system

### 12. Performance Optimization
**Priority:** Low
**Impact:** Faster responses

- [ ] Profile API call patterns
- [ ] Optimize parallel request batching
- [ ] Review cache expiration strategies
- [ ] Consider adding request deduplication

### 13. Documentation Updates
**Priority:** Low
**Impact:** Maintainability

- [ ] Update README.md with new tools as they're added
- [ ] Update CLAUDE.md with new patterns and practices
- [ ] Add inline code documentation for complex functions
- [ ] Create troubleshooting guide for common issues

---

## 🚀 Future Enhancements (Backlog)

### Advanced Features
- [ ] **Injury Alerts:** Monitor injury reports and suggest replacements
- [ ] **Strength of Schedule:** Analyze upcoming opponent difficulty
- [ ] **Trade Finder:** Automatically identify beneficial trade opportunities
- [ ] **Draft Assistant:** Support for draft preparation and live drafting
- [ ] **Keeper League Analysis:** Evaluate keeper decisions
- [ ] **DFS Integration:** Daily fantasy sports lineup optimization

### Technical Improvements
- [ ] Add support for other fantasy platforms (ESPN, Yahoo)
- [ ] Implement webhook notifications for important events
- [ ] Add data export functionality (CSV, JSON)
- [ ] Create visualization outputs for complex analyses
- [ ] Add support for dynasty league valuations

---

## 📝 Notes

**Development Philosophy:** Ship fast, iterate faster. Prioritize working functionality that provides immediate value.

**Testing Approach:** Manual testing via Claude Desktop for now. Automated tests added as features stabilize.

**User Feedback:** Track common queries to identify missing functionality and improve tool descriptions.

**API Considerations:** Respect Sleeper API rate limits (1000 req/min). Current caching strategy handles this well.

---

Last Updated: 2025-09-30
