import { SleeperAPI } from './sleeper-api.js';
import type {
  SleeperLeague,
  SleeperRoster,
  EnrichedLeague,
  LeagueSummary,
  CrossLeagueMatchup,
  MatchupAnalysis,
  SleeperMatchup
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

  /**
   * Get cross-league matchup analysis for a specific week
   * This tool helps prioritize which leagues need attention based on matchup competitiveness
   */
  async getCrossLeagueMatchups(week?: number) {
    try {
      const configuredSeason = process.env.NFL_SEASON || '2025';
      const userId = process.env.SLEEPER_USER_ID;

      if (!userId) {
        throw new Error('User ID not configured');
      }

      // Default to week 1 if not specified
      const targetWeek = week || 1;

      // Get all user leagues
      const leagues = await this.sleeperAPI.getUserLeagues(userId, configuredSeason);

      if (leagues.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No leagues found for user ${userId} in ${configuredSeason} season.`
            }
          ]
        };
      }

      // Fetch matchups and rosters for each league in parallel
      const leagueMatchupPromises = leagues.map(async (league) => {
        try {
          const [matchups, rosters] = await Promise.all([
            this.sleeperAPI.getMatchups(league.league_id, targetWeek),
            this.sleeperAPI.getLeagueRosters(league.league_id)
          ]);

          // Find user's roster
          const userRoster = rosters.find(roster => roster.owner_id === userId);
          if (!userRoster) {
            return null; // User not in this league
          }

          // Find user's matchup
          const userMatchup = matchups.find(matchup => matchup.roster_id === userRoster.roster_id);
          if (!userMatchup) {
            return null; // No matchup data for this week
          }

          // Find opponent's matchup (same matchup_id, different roster_id)
          const opponentMatchup = matchups.find(
            matchup => matchup.matchup_id === userMatchup.matchup_id &&
                      matchup.roster_id !== userMatchup.roster_id
          );

          if (!opponentMatchup) {
            return null; // No opponent found (bye week or incomplete data)
          }

          // Calculate competitiveness based on point differential
          const pointDifference = Math.abs(userMatchup.points - opponentMatchup.points);
          let competitiveness: 'high' | 'medium' | 'low';
          let priority: number;

          if (pointDifference < 10) {
            competitiveness = 'high';
            priority = 1;
          } else if (pointDifference < 20) {
            competitiveness = 'medium';
            priority = 2;
          } else {
            competitiveness = 'low';
            priority = 3;
          }

          const crossLeagueMatchup: CrossLeagueMatchup = {
            league_name: league.name,
            league_id: league.league_id,
            matchup_id: userMatchup.matchup_id,
            user_roster_id: userMatchup.roster_id,
            user_points: userMatchup.points,
            opponent_points: opponentMatchup.points,
            projected_difference: userMatchup.points - opponentMatchup.points,
            competitiveness,
            priority,
            opponent_roster_id: opponentMatchup.roster_id
          };

          return crossLeagueMatchup;
        } catch (error) {
          console.error(`Error getting matchups for league ${league.league_id}:`, error);
          return null;
        }
      });

      // Wait for all league matchups to complete
      const allMatchups = await Promise.all(leagueMatchupPromises);

      // Filter out null results and sort by priority
      const validMatchups = allMatchups.filter((matchup): matchup is CrossLeagueMatchup => matchup !== null);
      validMatchups.sort((a, b) => a.priority - b.priority);

      // Categorize matchups by priority
      const highPriority = validMatchups.filter(m => m.competitiveness === 'high');
      const mediumPriority = validMatchups.filter(m => m.competitiveness === 'medium');
      const lowPriority = validMatchups.filter(m => m.competitiveness === 'low');

      const analysis: MatchupAnalysis = {
        week: targetWeek,
        total_matchups: validMatchups.length,
        high_priority: highPriority,
        medium_priority: mediumPriority,
        low_priority: lowPriority
      };

      // Format response
      const formatMatchup = (matchup: CrossLeagueMatchup) => {
        const isWinning = matchup.projected_difference > 0;
        const winChance = isWinning ?
          `${Math.min(95, 50 + (matchup.projected_difference / 2))}%` :
          `${Math.max(5, 50 + (matchup.projected_difference / 2))}%`;

        return `- **${matchup.league_name}**: ${matchup.user_points} vs ${matchup.opponent_points} ` +
               `(${isWinning ? '+' : ''}${matchup.projected_difference.toFixed(1)} pts, ~${winChance} chance)`;
      };

      return {
        content: [
          {
            type: 'text',
            text: `# Cross-League Matchups - Week ${targetWeek}\n\n` +
                  `**Total Matchups:** ${analysis.total_matchups}\n\n` +

                  (analysis.high_priority.length > 0 ?
                    `## 🔥 High Priority (Close Games - <10 pt difference)\n` +
                    `${analysis.high_priority.map(formatMatchup).join('\n')}\n\n` : '') +

                  (analysis.medium_priority.length > 0 ?
                    `## ⚡ Medium Priority (Moderate Games - 10-20 pt difference)\n` +
                    `${analysis.medium_priority.map(formatMatchup).join('\n')}\n\n` : '') +

                  (analysis.low_priority.length > 0 ?
                    `## ✅ Low Priority (Decided Games - >20 pt difference)\n` +
                    `${analysis.low_priority.map(formatMatchup).join('\n')}\n\n` : '') +

                  `## 🎯 Action Items\n` +
                  (analysis.high_priority.length > 0 ?
                    `- **Focus attention** on ${analysis.high_priority.map(m => m.league_name).join(', ')} - these games are very close!\n` : '') +
                  (analysis.medium_priority.length > 0 ?
                    `- **Monitor closely** ${analysis.medium_priority.map(m => m.league_name).join(', ')} - winnable with right moves\n` : '') +
                  (analysis.low_priority.length > 0 ?
                    `- **Autopilot mode** for ${analysis.low_priority.map(m => m.league_name).join(', ')} - likely outcomes determined\n` : '') +
                  `\n**Recommendation:** Prioritize waiver claims and lineup optimization for high-priority leagues first.`
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to get cross-league matchups: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}