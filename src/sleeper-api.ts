import axios, { type AxiosInstance, AxiosError } from 'axios';
import type { SleeperUser, SleeperLeague, SleeperRoster, SleeperPlayer, SleeperMatchup, CacheEntry } from './types.js';

export class SleeperAPI {
  private client: AxiosInstance;
  private cache: Map<string, CacheEntry<any>> = new Map();
  private cacheDuration: number;

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
   * Clear cache - useful for testing and forcing fresh data
   */
  clearCache(): void {
    this.cache.clear();
  }
}