import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { SleeperPlayer } from './types.js';

export interface PlayerCacheStatus {
  exists: boolean;
  lastUpdated: Date | null;
  isExpired: boolean;
  playerCount: number;
  fileSizeMB: number;
}

export class PlayerCache {
  private cacheFilePath: string;
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  private playersCache: Map<string, SleeperPlayer> | null = null;

  constructor(dataDir: string = 'data') {
    // Corrija o __dirname para ES Modules
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const absoluteDataDir = path.isAbsolute(dataDir)
      ? dataDir
      : path.join(__dirname, '..', dataDir); // Agora funciona em ES Modules
    this.cacheFilePath = path.join(absoluteDataDir, 'players.json');

    // Ensure data directory exists synchronously
    this.ensureDataDirectorySync();
  }

  private ensureDataDirectorySync(): void {
    const dataDir = path.dirname(this.cacheFilePath);
    try {
      require('fs').mkdirSync(dataDir, { recursive: true });
    } catch (error) {
      // Directory already exists or created successfully
    }
  }

  /**
   * Get the status of the player cache
   */
  async getCacheStatus(): Promise<PlayerCacheStatus> {
    try {
      const stats = await fs.stat(this.cacheFilePath);
      const lastUpdated = stats.mtime;
      const isExpired = Date.now() - lastUpdated.getTime() > this.CACHE_DURATION;
      const fileSizeMB = stats.size / (1024 * 1024);

      // Try to get player count without loading the entire file
      let playerCount = 0;
      if (!isExpired) {
        try {
          const data = await fs.readFile(this.cacheFilePath, 'utf8');
          const players = JSON.parse(data);
          playerCount = Object.keys(players).length;
        } catch (error) {
          // If we can't parse, treat as expired
          return {
            exists: true,
            lastUpdated,
            isExpired: true,
            playerCount: 0,
            fileSizeMB
          };
        }
      }

      return {
        exists: true,
        lastUpdated,
        isExpired,
        playerCount,
        fileSizeMB
      };
    } catch (error) {
      return {
        exists: false,
        lastUpdated: null,
        isExpired: true,
        playerCount: 0,
        fileSizeMB: 0
      };
    }
  }

  /**
   * Load players from cache or return null if cache is invalid/expired
   */
  async loadPlayersFromCache(): Promise<Map<string, SleeperPlayer> | null> {
    if (this.playersCache) {
      return this.playersCache;
    }

    const status = await this.getCacheStatus();
    if (!status.exists || status.isExpired) {
      return null;
    }

    try {
      const data = await fs.readFile(this.cacheFilePath, 'utf8');

      let playersData: Record<string, SleeperPlayer>;
      try {
        playersData = JSON.parse(data);
      } catch (parseError) {
        // Delete corrupted cache file
        try {
          await fs.unlink(this.cacheFilePath);
        } catch (deleteError) {
          // Ignore cleanup errors
        }
        return null;
      }

      this.playersCache = new Map();
      for (const [playerId, player] of Object.entries(playersData)) {
        this.playersCache.set(playerId, player as SleeperPlayer);
      }

      return this.playersCache;
    } catch (error) {
      return null;
    }
  }

  /**
   * Save players to cache file
   */
  async savePlayersToCache(players: Record<string, SleeperPlayer>): Promise<void> {
    try {
      console.log(`Saving ${Object.keys(players).length} players to cache at ${this.cacheFilePath}`);

      // Ensure the data directory exists
      await fs.mkdir(path.dirname(this.cacheFilePath), { recursive: true });

      // Validate JSON before writing
      let jsonString: string;
      try {
        jsonString = JSON.stringify(players);
        // Test that we can parse it back
        JSON.parse(jsonString);
      } catch (jsonError) {
        console.error('Invalid JSON data, cannot save to cache:', jsonError);
        throw new Error('Player data contains invalid JSON');
      }

      // Write to temporary file first, then rename for atomic operation
      const tempFilePath = `${this.cacheFilePath}.tmp`;
      await fs.writeFile(tempFilePath, jsonString, 'utf8');

      // Verify the written file
      try {
        const testRead = await fs.readFile(tempFilePath, 'utf8');
        JSON.parse(testRead);
        console.log('Cache file verified successfully');
      } catch (verifyError) {
        console.error('Cache file verification failed:', verifyError);
        throw new Error('Cache file is corrupted after writing');
      }

      await fs.rename(tempFilePath, this.cacheFilePath);

      // Update in-memory cache
      this.playersCache = new Map();
      for (const [playerId, player] of Object.entries(players)) {
        this.playersCache.set(playerId, player);
      }

      console.log(`Player cache saved successfully with ${Object.keys(players).length} players`);
    } catch (error) {
      console.error('Failed to save players to cache:', error);

      // Clean up temp file if it exists
      try {
        await fs.unlink(`${this.cacheFilePath}.tmp`);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }

      throw error;
    }
  }

  /**
   * Get a specific player by ID
   */
  async getPlayer(playerId: string): Promise<SleeperPlayer | null> {
    const players = await this.loadPlayersFromCache();
    if (!players) {
      return null;
    }
    return players.get(playerId) || null;
  }

  /**
   * Get multiple players by their IDs
   */
  async getPlayers(playerIds: string[]): Promise<Map<string, SleeperPlayer>> {
    const players = await this.loadPlayersFromCache();
    const result = new Map<string, SleeperPlayer>();

    if (!players) {
      return result;
    }

    for (const playerId of playerIds) {
      const player = players.get(playerId);
      if (player) {
        result.set(playerId, player);
      }
    }

    return result;
  }

  /**
   * Search players by name (useful for debugging and manual queries)
   */
  async searchPlayersByName(searchTerm: string, limit: number = 10): Promise<SleeperPlayer[]> {
    const players = await this.loadPlayersFromCache();
    if (!players) {
      return [];
    }

    const results: SleeperPlayer[] = [];
    const searchLower = searchTerm.toLowerCase();

    for (const player of players.values()) {
      if (player.full_name?.toLowerCase().includes(searchLower) ||
          player.first_name?.toLowerCase().includes(searchLower) ||
          player.last_name?.toLowerCase().includes(searchLower)) {
        results.push(player);
        if (results.length >= limit) {
          break;
        }
      }
    }

    return results;
  }

  /**
   * Clear the cache (both file and memory)
   */
  async clearCache(): Promise<void> {
    try {
      await fs.unlink(this.cacheFilePath);
    } catch (error) {
      // File might not exist, that's okay
    }

    this.playersCache = null;
  }

  /**
   * Force refresh the cache by clearing it
   */
  async refreshCache(): Promise<void> {
    await this.clearCache();
  }
}