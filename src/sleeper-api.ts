import axios, { type AxiosInstance, AxiosError } from 'axios';
import type { SleeperUser, SleeperLeague, SleeperRoster, SleeperPlayer, SleeperMatchup, CacheEntry } from './types.js';
import { PlayerCache } from './player-cache.js';

export class SleeperAPI {
  private client: AxiosInstance;
  private cache: Map<string, CacheEntry<any>> = new Map();
  private cacheDuration: number;
  private playerCache: PlayerCache;

  constructor(cacheDurationMinutes: number = 5) {
    // Create axios instance with Sleeper API base configuration
    this.client = axios.create({
      baseURL: 'https://api.sleeper.app/v1',
      timeout: 10000, // 10 second timeout for API calls
      headers: {
        'User-Agent': 'Sleeper-MCP-Server/1.0'
      }
    });

    this.cacheDuration = cacheDurationMinutes * 60 * 1000; // Convert to milliseconds
    this.playerCache = new PlayerCache();
    
    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      response => response,
      this.handleApiError.bind(this)
    );
  }

  /**
   * Handle API errors with informative error messages
   * This helps debug issues during development
   */
  private handleApiError(error: AxiosError): Promise<never> {
    if (error.response) {
      // Server responded with error status
      throw new Error(`Sleeper API Error ${error.response.status}: ${error.response.statusText}`);
    } else if (error.request) {
      // Request was made but no response received
      throw new Error('No response from Sleeper API - check your internet connection');
    } else {
      // Something else happened
      throw new Error(`Request Error: ${error.message}`);
    }
  }

  /**
   * Generic caching method that reduces API calls and improves performance
   * This is crucial for multi-league operations
   */
  private async getCached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const cached = this.cache.get(key);
    
    if (cached && Date.now() < cached.expires_at) {
      return cached.data;
    }

    const data = await fetcher();
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expires_at: Date.now() + this.cacheDuration
    });

    return data;
  }

  /**
   * Get user information by username
   * This is often the starting point for discovering a user's leagues
   */
  async getUser(username: string): Promise<SleeperUser> {
    const cacheKey = `user:${username}`;
    
    return this.getCached(cacheKey, async () => {
      const response = await this.client.get(`/user/${username}`);
      return response.data;
    });
  }

  /**
   * Get all leagues for a user in a specific season
   * This is the core of your auto-discovery functionality
   */
  async getUserLeagues(userId: string, season: string = '2024'): Promise<SleeperLeague[]> {
    const cacheKey = `user_leagues:${userId}:${season}`;
    
    return this.getCached(cacheKey, async () => {
      const response = await this.client.get(`/user/${userId}/leagues/nfl/${season}`);
      return response.data || [];
    });
  }

  /**
   * Get detailed information about a specific league
   * This provides the scoring settings and rules needed for analysis
   */
  async getLeague(leagueId: string): Promise<SleeperLeague> {
    const cacheKey = `league:${leagueId}`;
    
    return this.getCached(cacheKey, async () => {
      const response = await this.client.get(`/league/${leagueId}`);
      return response.data;
    });
  }

  /**
   * Get all rosters in a league
   * This provides team composition data for analysis
   */
  async getLeagueRosters(leagueId: string): Promise<SleeperRoster[]> {
    const cacheKey = `rosters:${leagueId}`;
    
    return this.getCached(cacheKey, async () => {
      const response = await this.client.get(`/league/${leagueId}/rosters`);
      return response.data || [];
    });
  }

  /**
   * Get matchups for a specific week
   * This provides head-to-head competition data
   */
  async getMatchups(leagueId: string, week: number): Promise<SleeperMatchup[]> {
    const cacheKey = `matchups:${leagueId}:${week}`;

    return this.getCached(cacheKey, async () => {
      const response = await this.client.get(`/league/${leagueId}/matchups/${week}`);
      return response.data || [];
    });
  }

  /**
   * Get all users in a league
   * This provides owner information for rosters
   */
  async getLeagueUsers(leagueId: string): Promise<SleeperUser[]> {
    const cacheKey = `league_users:${leagueId}`;

    return this.getCached(cacheKey, async () => {
      const response = await this.client.get(`/league/${leagueId}/users`);
      return response.data || [];
    });
  }

  /**
   * Get all players from Sleeper API with smart caching
   * This endpoint returns ~5MB of data and should only be called once per day
   */
  async getPlayers(): Promise<Map<string, SleeperPlayer>> {
    // Try to load from cache first
    const cachedPlayers = await this.playerCache.loadPlayersFromCache();
    if (cachedPlayers) {
      return cachedPlayers;
    }

    // If cache is expired or doesn't exist, fetch from API
    try {
      const response = await this.client.get('/players/nfl');
      const playersData = response.data;

      // Save to persistent cache
      await this.playerCache.savePlayersToCache(playersData);

      // Return as Map
      const playersMap = new Map<string, SleeperPlayer>();
      for (const [playerId, player] of Object.entries(playersData)) {
        playersMap.set(playerId, player as SleeperPlayer);
      }

      return playersMap;
    } catch (error) {
      throw new Error(`Unable to fetch player data from Sleeper API: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get specific players by their IDs
   */
  async getPlayersByIds(playerIds: string[]): Promise<Map<string, SleeperPlayer>> {
    return await this.playerCache.getPlayers(playerIds);
  }

  /**
   * Get a single player by ID
   */
  async getPlayer(playerId: string): Promise<SleeperPlayer | null> {
    return await this.playerCache.getPlayer(playerId);
  }

  /**
   * Search players by name (useful for debugging)
   */
  async searchPlayers(searchTerm: string, limit: number = 10): Promise<SleeperPlayer[]> {
    return await this.playerCache.searchPlayersByName(searchTerm, limit);
  }

  /**
   * Get player cache status for debugging and management
   */
  async getPlayerCacheStatus() {
    return await this.playerCache.getCacheStatus();
  }

  /**
   * Force refresh the player cache
   */
  async refreshPlayerCache(): Promise<void> {
    await this.playerCache.refreshCache();
    // This will trigger a fresh fetch on the next getPlayers() call
  }

  /**
   * Clear cache - useful for testing and forcing fresh data
   */
  clearCache(): void {
    this.cache.clear();
  }
}