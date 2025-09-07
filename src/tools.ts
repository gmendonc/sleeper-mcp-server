import { SleeperAPI } from './sleeper-api.js';
import type { 
  SleeperLeague,
  SleeperRoster, 
  EnrichedLeague,
  LeagueSummary
 } from './types.js';

export class SleeperTools {
  constructor(private sleeperAPI: SleeperAPI) {}

  /**
   * Get comprehensive league information
   * This tool provides the foundation data for fantasy analysis
   */
  async getLeagueInfo(leagueId: string) {
    try {
      const league = await this.sleeperAPI.getLeague(leagueId);
      const rosters = await this.sleeperAPI.getLeagueRosters(leagueId);

      // Calculate league statistics for analysis
      const activeRosters = rosters.filter(roster => roster.owner_id);
      const totalPoints = activeRosters.reduce((sum, roster) => sum + roster.settings.fpts, 0);
      const averagePoints = totalPoints / activeRosters.length;

      // Format scoring settings in a readable way
      const keyScoring = {
        'Passing TD': league.scoring_settings.pass_td || 0,
        'Rushing TD': league.scoring_settings.rush_td || 0,
        'Receiving TD': league.scoring_settings.rec_td || 0,
        'Passing Yards': league.scoring_settings.pass_yd || 0,
        'Rushing Yards': league.scoring_settings.rush_yd || 0,
        'Receiving Yards': league.scoring_settings.rec_yd || 0,
        'Reception': league.scoring_settings.rec || 0
      };

      return {
        content: [
          {
            type: 'text',
            text: `# ${league.name} League Information\n\n` +
                  `**League Status:** ${league.status}\n` +
                  `**Season:** ${league.season}\n` +
                  `**Teams:** ${league.total_rosters}\n` +
                  `**Active Rosters:** ${activeRosters.length}\n\n` +
                  
                  `## Roster Requirements\n` +
                  `${league.roster_positions.join(', ')}\n\n` +
                  
                  `## Key Scoring Settings\n` +
                  `${Object.entries(keyScoring)
                    .filter(([_, value]) => value !== 0)
                    .map(([setting, value]) => `- ${setting}: ${value}`)
                    .join('\n')}\n\n` +
                  
                  `## League Statistics\n` +
                  `- Average Points Per Team: ${averagePoints.toFixed(1)}\n` +
                  `- Total Points Scored: ${totalPoints.toFixed(1)}\n\n` +
                  
                  `## Settings\n` +
                  `- Waiver Type: ${league.settings.waiver_type === 0 ? 'Free Agency' : 'Waiver Wire'}\n` +
                  `- Trade Deadline: Week ${league.settings.trade_deadline}\n` +
                  `- Playoffs Start: Week ${league.settings.playoff_week_start}`
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to get league information: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Discover all leagues for the configured user
   * This is the foundation of multi-league analysis
   */
  async discoverUserLeagues(season?: string) {
    try {
      const configuredSeason = season || process.env.NFL_SEASON || '2025';
      const userId = process.env.SLEEPER_USER_ID;
    
      if (!userId) {
        throw new Error('User ID not configured');
      }

      const leagues = await this.sleeperAPI.getUserLeagues(userId, configuredSeason);
    
      if (leagues.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No leagues found for user ${userId} in ${configuredSeason} season.\n\nThis could mean:\n- You don't have any active leagues this season\n- Your user ID might be incorrect\n- The season parameter might be wrong\n\nTry checking your Sleeper profile to verify your user ID.`
            }
          ]
        };
      }

      // Enrich league data with additional context
      const enrichedLeagues: EnrichedLeague[] = await Promise.all(
        leagues.map(async (league): Promise<EnrichedLeague> => {
          try {
            const rosters = await this.sleeperAPI.getLeagueRosters(league.league_id);
            const userRoster = rosters.find(roster => roster.owner_id === userId);
          
            // Create enriched league object with proper typing
            const enrichedLeague: EnrichedLeague = {
              ...league, // Spread all original league properties
              user_roster_id: userRoster?.roster_id,
              user_record: userRoster ? {
                wins: userRoster.settings.wins,
                losses: userRoster.settings.losses,
                ties: userRoster.settings.ties,
                points_for: userRoster.settings.fpts,
                points_against: userRoster.settings.fpts_against
              } : undefined
            };

            return enrichedLeague;
          } catch (error) {
            // If we can't get roster data, still include the league
            console.error(`Could not get roster data for league ${league.league_id}:`, error);
            return {
              ...league,
              user_roster_id: undefined,
              user_record: undefined
            };
          }
        })
      );

      // Sort leagues by performance and activity
      enrichedLeagues.sort((a, b) => {
        // Active leagues first
        if (a.status !== b.status) {
          return a.status === 'in_season' ? -1 : 1;
        }
      
        // Then by win percentage if we have record data
        if (a.user_record && b.user_record) {
          const aWinPct = a.user_record.wins / (a.user_record.wins + a.user_record.losses);
          const bWinPct = b.user_record.wins / (b.user_record.wins + b.user_record.losses);
          return bWinPct - aWinPct;
        }
      
        return 0;
      });

      // Format the response with analysis
      const totalLeagues = enrichedLeagues.length;
      const activeLeagues = enrichedLeagues.filter(l => l.status === 'in_season').length;
      const leaguesWithRecord = enrichedLeagues.filter(l => l.user_record).length;
    
      let overallRecord = { wins: 0, losses: 0, ties: 0 };
      enrichedLeagues.forEach(league => {
        if (league.user_record) {
          overallRecord.wins += league.user_record.wins;
          overallRecord.losses += league.user_record.losses;
          overallRecord.ties += league.user_record.ties;
        }
      });

      const overallWinPct = overallRecord.wins / (overallRecord.wins + overallRecord.losses) * 100;

      return {
        content: [
          {
            type: 'text',
            text: `# Your ${configuredSeason} Fantasy Football Leagues\n\n` +
                  `**Total Leagues:** ${totalLeagues}\n` +
                  `**Active Leagues:** ${activeLeagues}\n` +
                  `**Overall Record:** ${overallRecord.wins}-${overallRecord.losses}-${overallRecord.ties} (${overallWinPct.toFixed(1)}%)\n\n` +
                
                  `## League Details\n\n` +
                  enrichedLeagues.map((league, index) => {
                    const status = league.status === 'in_season' ? '🏈 Active' : 
                                 league.status === 'complete' ? '✅ Complete' : 
                                 league.status === 'drafting' ? '📝 Drafting' : '⏳ Pre-Draft';
                  
                    const record = league.user_record ? 
                      ` | Record: ${league.user_record.wins}-${league.user_record.losses}-${league.user_record.ties}` : '';
                  
                    return `${index + 1}. **${league.name}**\n` +
                           `   - ${status} | ${league.total_rosters} teams${record}\n` +
                           `   - League ID: \`${league.league_id}\`\n`;
                  }).join('\n') +
                
                  `\n## Quick Actions\n` +
                  `- Ask about a specific league: "Tell me about [league name]"\n` +
                  `- Get matchup analysis: "What are this week's matchups across all leagues?"\n` +
                  `- Find waiver targets: "What are the best waiver wire pickups?"\n` +
                  `- Roster analysis: "Which of my teams needs the most help?"`
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to discover leagues: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}