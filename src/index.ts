#!/usr/bin/env node

// Load environment variables from .env file
import 'dotenv/config';

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema,
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js';

import { SleeperAPI } from './sleeper-api.js';
import type { ServerConfig } from './types.js';

// Add import for tools
import { SleeperTools } from './tools.js';

class SleeperMCPServer {
  private server: Server;
  private sleeperAPI: SleeperAPI;
  private config: ServerConfig;
  private sleeperTools: SleeperTools;

  constructor() {
    // Load configuration from environment variables
    this.config = {
      sleeper_user_id: process.env.SLEEPER_USER_ID || '',
      nfl_season: process.env.NFL_SEASON || '2025',
      cache_duration: parseInt(process.env.CACHE_DURATION || '5')
    };

    // Validate required configuration
    if (!this.config.sleeper_user_id) {
      throw new Error('SLEEPER_USER_ID environment variable is required');
    }

    // Initialize Sleeper API client
    this.sleeperAPI = new SleeperAPI(this.config.cache_duration);

    // Initialize MCP server
    this.server = new Server(
      {
        name: 'sleeper-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    // Initialize tools
    this.sleeperTools = new SleeperTools(this.sleeperAPI);
  }

  /**
   * Set up MCP tool handlers
   * This is where we define what tools Claude can call
   */
  private setupToolHandlers(): void {
    // Register available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'test_connection',
            description: 'Test connection to Sleeper API and verify user configuration',
            inputSchema: {
              type: 'object',
              properties: {},
              required: []
            }
          },
          {
            name: 'get_league_info',
            description: 'Get detailed information about a specific league including scoring settings, roster requirements, and league statistics',
            inputSchema: {
              type: 'object',
              properties: {
                league_id: {
                  type: 'string',
                  description: 'The Sleeper league ID to get information for'
                }
              },
              required: ['league_id']
            }
          },
          {
            name: 'discover_user_leagues',
            description: 'Automatically discover all leagues for the configured user in a specific season',
            inputSchema: {
                type: 'object',
                properties: {
                    season: {
                        type: 'string',
                        description: 'NFL season year (defaults to configured season)',
                        default: '2025'
                    }
                },
                required: []
            }
         },
         {
            name: 'get_cross_league_matchups',
            description: 'Get matchup analysis across all user leagues for a specific week, prioritized by competitiveness',
            inputSchema: {
                type: 'object',
                properties: {
                    week: {
                        type: 'number',
                        description: 'NFL week number (1-18), defaults to week 1'
                    }
                },
                required: []
            }
         },
         {
            name: 'get_multi_roster_analysis',
            description: 'Analyze roster composition across all user teams, identifying positional strengths/weaknesses and providing cross-league roster comparisons with actual player names',
            inputSchema: {
                type: 'object',
                properties: {},
                required: []
            }
         },
         {
            name: 'manage_player_cache',
            description: 'Manage the player database cache (status/refresh/clear) - useful for debugging and ensuring fresh player data',
            inputSchema: {
                type: 'object',
                properties: {
                    action: {
                        type: 'string',
                        description: 'Action to perform: status (default), refresh, or clear',
                        enum: ['status', 'refresh', 'clear'],
                        default: 'status'
                    }
                },
                required: []
            }
         },
         {
            name: 'get_league_roster',
            description: 'Get detailed roster information for a team in a specific league, including starters, bench players, player names, positions, teams, and injury status. Can show your roster, a specific team roster, or all rosters in the league.',
            inputSchema: {
                type: 'object',
                properties: {
                    league_id: {
                        type: 'string',
                        description: 'The Sleeper league ID to get roster for'
                    },
                    roster_id: {
                        type: 'number',
                        description: 'Optional: specific roster ID to view (1-16). If not provided, shows your roster. Use 0 to see all rosters in the league as a summary.'
                    }
                },
                required: ['league_id']
            }
         }
        ]
      };
    });

    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      // First, let's validate that we have the basic request structure
      if (!request.params || !request.params.name) {
        throw new McpError(
            ErrorCode.InvalidRequest,
            'Request missing required params or tool name'
        );
      }
      switch (request.params.name) {
        case 'test_connection':
          return this.handleTestConnection();
        case 'get_league_info': {
          // Validate that arguments exist and contain the required league_id
          const args = request.params.arguments;
      
          // Check if arguments exist at all
          if (!args || typeof args !== 'object') {
            throw new McpError(
                ErrorCode.InvalidParams,
                'get_league_info requires arguments object'
            );
          }
          // Check if league_id exists and is a string
          const leagueId = (args as any).league_id;
          if (!leagueId || typeof leagueId !== 'string') {
            throw new McpError(
              ErrorCode.InvalidParams,
              'get_league_info requires a valid league_id string parameter'
            );
          }
      
          // Now we can safely call the method with validated data
          return this.sleeperTools.getLeagueInfo(leagueId);
        }
        case 'discover_user_leagues': {
            // For this tool, arguments are optional, but if they exist, validate them
            const args = request.params.arguments;
            let season: string | undefined;

            if (args && typeof args === 'object') {
                const providedSeason = (args as any).season;
                if (providedSeason && typeof providedSeason === 'string') {
                    season = providedSeason;
                }
            }

            return this.sleeperTools.discoverUserLeagues(season);
        }
        case 'get_cross_league_matchups': {
            // For this tool, arguments are optional, but if they exist, validate them
            const args = request.params.arguments;
            let week: number | undefined;

            if (args && typeof args === 'object') {
                const providedWeek = (args as any).week;
                if (providedWeek && typeof providedWeek === 'number') {
                    week = providedWeek;
                }
            }

            return this.sleeperTools.getCrossLeagueMatchups(week);
        }
        case 'get_multi_roster_analysis': {
            // No arguments needed for this tool
            return this.sleeperTools.getMultiRosterAnalysis();
        }
        case 'manage_player_cache': {
            // Arguments are optional, but if they exist, validate them
            const args = request.params.arguments;
            let action: 'status' | 'refresh' | 'clear' = 'status';

            if (args && typeof args === 'object') {
                const providedAction = (args as any).action;
                if (providedAction && typeof providedAction === 'string') {
                    if (['status', 'refresh', 'clear'].includes(providedAction)) {
                        action = providedAction as 'status' | 'refresh' | 'clear';
                    }
                }
            }

            return this.sleeperTools.managePlayerCache(action);
        }
        case 'get_league_roster': {
            // Validate that arguments exist and contain the required league_id
            const args = request.params.arguments;

            // Check if arguments exist at all
            if (!args || typeof args !== 'object') {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    'get_league_roster requires arguments object'
                );
            }

            // Check if league_id exists and is a string
            const leagueId = (args as any).league_id;
            if (!leagueId || typeof leagueId !== 'string') {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    'get_league_roster requires a valid league_id string parameter'
                );
            }

            // Extract optional roster_id
            let rosterId: number | undefined;
            const providedRosterId = (args as any).roster_id;
            if (providedRosterId !== undefined && providedRosterId !== null) {
                if (typeof providedRosterId === 'number') {
                    rosterId = providedRosterId;
                } else {
                    throw new McpError(
                        ErrorCode.InvalidParams,
                        'roster_id must be a number if provided'
                    );
                }
            }

            // Now we can safely call the method with validated data
            return this.sleeperTools.getLeagueRoster(leagueId, rosterId);
        }

        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
      }
    });
  }

  /**
   * Test connection tool - validates that everything is working
   * This gives you immediate feedback that your setup is correct
   */
  private async handleTestConnection() {
    try {
      // Try to get user's leagues to validate configuration
      const leagues = await this.sleeperAPI.getUserLeagues(
        this.config.sleeper_user_id, 
        this.config.nfl_season
      );

      return {
        content: [
          {
            type: 'text',
            text: `✅ Connection successful!\n\nFound ${leagues.length} leagues for user ${this.config.sleeper_user_id} in ${this.config.nfl_season} season.\n\nLeagues:\n${leagues.map(league => `- ${league.name} (${league.total_rosters} teams)`).join('\n')}`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease check your SLEEPER_USER_ID configuration.`
          }
        ]
      };
    }
  }

  /**
   * Start the MCP server
   */
  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Sleeper MCP Server running on stdio');
  }
}

// Start the server
const server = new SleeperMCPServer();
server.run().catch(console.error);