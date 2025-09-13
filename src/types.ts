// Core user and league identification types
export interface SleeperUser {
  user_id: string;
  username: string;
  display_name: string;
  avatar?: string;
}

// League information that forms the foundation of all analysis
export interface SleeperLeague {
  league_id: string;
  name: string;
  status: 'pre_draft' | 'drafting' | 'in_season' | 'complete';
  season: string;
  season_type: 'regular' | 'post';
  total_rosters: number;
  scoring_settings: Record<string, number>;
  roster_positions: string[];
  settings: {
    waiver_type: number;
    trade_deadline: number;
    playoff_week_start: number;
    // Add other league settings as needed
  };
}

// Individual team roster within a league
export interface SleeperRoster {
  roster_id: number;
  owner_id: string;
  players: string[];
  starters: string[];
  settings: {
    wins: number;
    losses: number;
    ties: number;
    fpts: number;
    fpts_against: number;
  };
}

// Player information from Sleeper's player database
export interface SleeperPlayer {
  player_id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  position: string;
  team: string;
  status: 'Active' | 'Inactive' | 'IR' | 'PUP';
  fantasy_positions: string[];
}

// Weekly matchup data for head-to-head analysis
export interface SleeperMatchup {
  matchup_id: number;
  roster_id: number;
  points: number;
  players: string[];
  starters: string[];
  players_points: Record<string, number>;
  starters_points: Record<string, number>;
}

// Configuration and caching types
export interface ServerConfig {
  sleeper_user_id: string;
  nfl_season: string;
  cache_duration: number;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expires_at: number;
}

// Add these new interfaces to your existing types.ts file

// Enriched league data that includes user-specific information
export interface EnrichedLeague extends SleeperLeague {
  user_roster_id?: number | undefined;
  user_record?: {
    wins: number;
    losses: number;
    ties: number;
    points_for: number;
    points_against: number;
  } | undefined;
}

// For even more detailed analysis, you might want this type
export interface LeagueWithUserData {
  league: SleeperLeague;
  rosters: SleeperRoster[];
  userRoster?: SleeperRoster;
  league_id: string;
}

// Summary data for cross-league analysis
export interface LeagueSummary {
  name: string;
  status: string;
  record?: {
    wins: number;
    losses: number;
    ties: number;
    points_for: number;
    points_against: number;
  };
  league_id: string;
}

// Cross-league matchup analysis types
export interface CrossLeagueMatchup {
  league_name: string;
  league_id: string;
  matchup_id: number;
  user_roster_id: number;
  user_points: number;
  opponent_points: number;
  projected_difference: number;
  competitiveness: 'high' | 'medium' | 'low';
  priority: number;
  opponent_roster_id?: number;
}

export interface MatchupAnalysis {
  week: number;
  total_matchups: number;
  high_priority: CrossLeagueMatchup[];
  medium_priority: CrossLeagueMatchup[];
  low_priority: CrossLeagueMatchup[];
}

// Multi-roster analysis types
export interface EnrichedRosterPlayer {
  player_id: string;
  full_name: string;
  position: string;
  team: string;
  status: 'Active' | 'Inactive' | 'IR' | 'PUP';
  fantasy_positions: string[];
  is_starter: boolean;
}

export interface PositionDepth {
  position: string;
  starters: EnrichedRosterPlayer[];
  bench: EnrichedRosterPlayer[];
  total_count: number;
  starter_count: number;
  bench_count: number;
  strength: 'Strong' | 'Average' | 'Weak';
  depth_score: number;
}

export interface RosterAnalysis {
  league_id: string;
  league_name: string;
  roster_id: number;
  team_record?: {
    wins: number;
    losses: number;
    ties: number;
    points_for: number;
    points_against: number;
  };
  positions: PositionDepth[];
  total_players: number;
  starters: EnrichedRosterPlayer[];
  bench: EnrichedRosterPlayer[];
  strengths: string[];
  weaknesses: string[];
  priority_positions: string[];
  overall_strength: 'Strong' | 'Average' | 'Weak';
}

export interface MultiRosterComparison {
  total_teams: number;
  total_players: number;
  position_analysis: {
    position: string;
    strongest_team: {
      league_name: string;
      league_id: string;
      depth_score: number;
    };
    weakest_team: {
      league_name: string;
      league_id: string;
      depth_score: number;
    };
    average_depth: number;
  }[];
  overall_recommendations: {
    position: string;
    reason: string;
    affected_teams: string[];
  }[];
  team_rankings: {
    league_name: string;
    league_id: string;
    overall_strength: 'Strong' | 'Average' | 'Weak';
    strengths: string[];
    weaknesses: string[];
  }[];
}