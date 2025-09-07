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