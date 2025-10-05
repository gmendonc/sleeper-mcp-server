import { SleeperAPI } from './sleeper-api.js';
import type {
  SleeperLeague,
  SleeperRoster,
  SleeperPlayer,
  SleeperUser,
  EnrichedLeague,
  LeagueSummary,
  CrossLeagueMatchup,
  MatchupAnalysis,
  SleeperMatchup,
  EnrichedRosterPlayer,
  PositionDepth,
  RosterAnalysis,
  MultiRosterComparison,
  WaiverPlayerTarget,
  WaiverAnalysis
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

  /**
   * Enrich players array with detailed player information
   */
  private async enrichPlayers(playerIds: string[], starterIds: string[]): Promise<EnrichedRosterPlayer[]> {
    // First, ensure we have player data by trying to fetch it
    try {
      await this.sleeperAPI.getPlayers();
    } catch (error) {
      throw new Error('Player cache needs to be refreshed. Use the "manage_player_cache" tool with action "refresh" first.');
    }

    const playersData = await this.sleeperAPI.getPlayersByIds(playerIds);

    const enrichedPlayers = playerIds
      .map(playerId => {
        const player = playersData.get(playerId);
        if (!player) {
          // Create a placeholder for unknown players but still include them
          return {
            player_id: playerId,
            full_name: `Unknown Player (${playerId})`,
            position: 'FLEX', // Use FLEX instead of UNKNOWN so they don't get filtered
            team: 'N/A',
            status: 'Inactive' as const,
            fantasy_positions: ['FLEX'],
            is_starter: starterIds.includes(playerId)
          };
        }

        return {
          player_id: player.player_id,
          full_name: player.full_name || `${player.first_name || ''} ${player.last_name || ''}`.trim() || 'Unknown',
          position: player.position || 'FLEX',
          team: player.team || 'N/A',
          status: player.status || 'Inactive',
          fantasy_positions: player.fantasy_positions || ['FLEX'],
          is_starter: starterIds.includes(playerId)
        };
      });

    return enrichedPlayers;
  }

  /**
   * Group players by position and analyze depth
   */
  private groupPlayersByPosition(players: EnrichedRosterPlayer[], rosterPositions: string[]): PositionDepth[] {
    // Standard fantasy positions to analyze
    const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

    return positions.map(position => {
      const positionPlayers = players.filter(player =>
        player.position === position || player.fantasy_positions.includes(position)
      );

      const starters = positionPlayers.filter(player => player.is_starter);
      const bench = positionPlayers.filter(player => !player.is_starter);

      // Calculate depth score based on total players and starter quality
      let depthScore = 0;
      depthScore += starters.length * 3; // Starters are worth 3 points each
      depthScore += bench.length * 1; // Bench players are worth 1 point each

      // Adjust for position scarcity
      if (position === 'QB') {
        depthScore *= 0.8; // QBs are less critical in numbers
      } else if (position === 'RB' || position === 'WR') {
        depthScore *= 1.2; // RBs and WRs are more critical
      }

      // Determine strength category
      let strength: 'Strong' | 'Average' | 'Weak';
      if (position === 'QB') {
        strength = positionPlayers.length >= 2 ? 'Strong' : positionPlayers.length >= 1 ? 'Average' : 'Weak';
      } else if (position === 'K' || position === 'DEF') {
        strength = positionPlayers.length >= 2 ? 'Strong' : positionPlayers.length >= 1 ? 'Average' : 'Weak';
      } else {
        // RB, WR, TE
        strength = positionPlayers.length >= 4 ? 'Strong' : positionPlayers.length >= 2 ? 'Average' : 'Weak';
      }

      return {
        position,
        starters,
        bench,
        total_count: positionPlayers.length,
        starter_count: starters.length,
        bench_count: bench.length,
        strength,
        depth_score: Math.round(depthScore)
      };
    });
  }

  /**
   * Analyze a single roster for strengths and weaknesses
   */
  private analyzeRoster(
    league: SleeperLeague,
    roster: SleeperRoster,
    enrichedPlayers: EnrichedRosterPlayer[]
  ): RosterAnalysis {
    const positions = this.groupPlayersByPosition(enrichedPlayers, league.roster_positions);

    const starters = enrichedPlayers.filter(player => player.is_starter);
    const bench = enrichedPlayers.filter(player => !player.is_starter);

    // Identify strengths and weaknesses
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const priorityPositions: string[] = [];

    positions.forEach(pos => {
      if (pos.strength === 'Strong') {
        strengths.push(`${pos.position} (${pos.total_count} players)`);
      } else if (pos.strength === 'Weak') {
        weaknesses.push(`${pos.position} (${pos.total_count} players)`);
        priorityPositions.push(pos.position);
      }
    });

    // Calculate overall team strength
    const avgDepthScore = positions.reduce((sum, pos) => sum + pos.depth_score, 0) / positions.length;
    const strongPositions = positions.filter(pos => pos.strength === 'Strong').length;
    const weakPositions = positions.filter(pos => pos.strength === 'Weak').length;

    let overallStrength: 'Strong' | 'Average' | 'Weak';
    if (strongPositions >= 4 && weakPositions <= 1) {
      overallStrength = 'Strong';
    } else if (weakPositions >= 3) {
      overallStrength = 'Weak';
    } else {
      overallStrength = 'Average';
    }

    return {
      league_id: league.league_id,
      league_name: league.name,
      roster_id: roster.roster_id,
      team_record: {
        wins: roster.settings.wins,
        losses: roster.settings.losses,
        ties: roster.settings.ties,
        points_for: roster.settings.fpts,
        points_against: roster.settings.fpts_against
      },
      positions,
      total_players: enrichedPlayers.length,
      starters,
      bench,
      strengths,
      weaknesses,
      priority_positions: priorityPositions,
      overall_strength: overallStrength
    };
  }

  /**
   * Generate cross-league comparison and recommendations
   */
  private generateMultiRosterComparison(rosterAnalyses: RosterAnalysis[]): MultiRosterComparison {
    const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

    const positionAnalysis = positions.map(position => {
      const positionData = rosterAnalyses
        .map(roster => {
          const positionDepth = roster.positions.find(pos => pos.position === position);
          return positionDepth ? { roster, positionDepth } : null;
        })
        .filter((data): data is { roster: RosterAnalysis; positionDepth: PositionDepth } => data !== null);

      if (positionData.length === 0) {
        // Fallback for positions with no data
        return {
          position,
          strongest_team: {
            league_name: 'N/A',
            league_id: 'N/A',
            depth_score: 0
          },
          weakest_team: {
            league_name: 'N/A',
            league_id: 'N/A',
            depth_score: 0
          },
          average_depth: 0
        };
      }

      const sortedByDepth = positionData.sort((a, b) => b.positionDepth.depth_score - a.positionDepth.depth_score);
      const averageDepth = positionData.reduce((sum, data) => sum + data.positionDepth.depth_score, 0) / positionData.length;

      const strongest = sortedByDepth[0];
      const weakest = sortedByDepth[sortedByDepth.length - 1];

      return {
        position,
        strongest_team: {
          league_name: strongest?.roster.league_name || 'N/A',
          league_id: strongest?.roster.league_id || 'N/A',
          depth_score: strongest?.positionDepth.depth_score || 0
        },
        weakest_team: {
          league_name: weakest?.roster.league_name || 'N/A',
          league_id: weakest?.roster.league_id || 'N/A',
          depth_score: weakest?.positionDepth.depth_score || 0
        },
        average_depth: Math.round(averageDepth)
      };
    });

    // Generate overall recommendations
    const recommendations: MultiRosterComparison['overall_recommendations'] = [];

    // Find positions that are weak across multiple teams
    positions.forEach(position => {
      const weakTeams = rosterAnalyses.filter(roster =>
        roster.positions.find(pos => pos.position === position)?.strength === 'Weak'
      );

      if (weakTeams.length >= 2) {
        recommendations.push({
          position,
          reason: `${weakTeams.length} of your teams need ${position} depth`,
          affected_teams: weakTeams.map(team => team.league_name)
        });
      }
    });

    // Sort teams by overall strength
    const teamRankings = rosterAnalyses
      .map(roster => ({
        league_name: roster.league_name,
        league_id: roster.league_id,
        overall_strength: roster.overall_strength,
        strengths: roster.strengths,
        weaknesses: roster.weaknesses
      }))
      .sort((a, b) => {
        const strengthOrder = { 'Strong': 3, 'Average': 2, 'Weak': 1 };
        return strengthOrder[b.overall_strength] - strengthOrder[a.overall_strength];
      });

    const totalPlayers = rosterAnalyses.reduce((sum, roster) => sum + roster.total_players, 0);

    return {
      total_teams: rosterAnalyses.length,
      total_players: totalPlayers,
      position_analysis: positionAnalysis,
      overall_recommendations: recommendations,
      team_rankings: teamRankings
    };
  }

  /**
   * Get comprehensive multi-roster analysis across all user teams
   */
  async getMultiRosterAnalysis() {
    try {
      const configuredSeason = process.env.NFL_SEASON || '2025';
      const userId = process.env.SLEEPER_USER_ID;

      if (!userId) {
        throw new Error('User ID not configured');
      }

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

      // Analyze each roster in parallel
      const rosterAnalysisPromises = leagues.map(async (league) => {
        try {
          const rosters = await this.sleeperAPI.getLeagueRosters(league.league_id);
          const userRoster = rosters.find(roster => roster.owner_id === userId);

          if (!userRoster) {
            return null; // User not in this league
          }

          // Get all players (combine starters and players arrays to handle both)
          const allPlayerIds = Array.from(new Set([...(userRoster.players || []), ...(userRoster.starters || [])]));

          const enrichedPlayers = await this.enrichPlayers(allPlayerIds, userRoster.starters || []);

          return this.analyzeRoster(league, userRoster, enrichedPlayers);
        } catch (error) {
          return null;
        }
      });

      // Wait for all analyses to complete
      const allRosterAnalyses = await Promise.all(rosterAnalysisPromises);
      const validAnalyses = allRosterAnalyses.filter((analysis): analysis is RosterAnalysis => analysis !== null);

      if (validAnalyses.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: 'No roster data found for your leagues. This could indicate an issue with the player cache or API connectivity.'
            }
          ]
        };
      }

      // Generate cross-league comparison
      const comparison = this.generateMultiRosterComparison(validAnalyses);

      // Format the comprehensive response
      const formatPositionAnalysis = (pos: typeof comparison.position_analysis[0]) => {
        return `**${pos.position}**\n` +
               `  - Strongest: ${pos.strongest_team.league_name} (${pos.strongest_team.depth_score} depth)\n` +
               `  - Weakest: ${pos.weakest_team.league_name} (${pos.weakest_team.depth_score} depth)\n` +
               `  - Average: ${pos.average_depth} depth\n`;
      };

      const formatTeamRanking = (team: typeof comparison.team_rankings[0], index: number) => {
        const strengthEmoji = { 'Strong': '💪', 'Average': '⚖️', 'Weak': '⚠️' };

        // Find the corresponding roster analysis to get player details
        const rosterAnalysis = validAnalyses.find(r => r.league_id === team.league_id);
        let startersList = '';

        if (rosterAnalysis && rosterAnalysis.starters.length > 0) {
          const topStarters = rosterAnalysis.starters
            .slice(0, 5) // Show first 5 starters
            .map(p => `${p.full_name} (${p.position})`)
            .join(', ');
          startersList = `   - Key Starters: ${topStarters}\n`;
        }

        return `${index + 1}. ${strengthEmoji[team.overall_strength]} **${team.league_name}** (${team.overall_strength})\n` +
               startersList +
               (team.strengths.length > 0 ? `   - Strengths: ${team.strengths.join(', ')}\n` : '') +
               (team.weaknesses.length > 0 ? `   - Weaknesses: ${team.weaknesses.join(', ')}\n` : '');
      };

      return {
        content: [
          {
            type: 'text',
            text: `# Multi-Roster Analysis - ${configuredSeason} Season\n\n` +
                  `**Total Teams:** ${comparison.total_teams}\n` +
                  `**Total Players:** ${comparison.total_players}\n\n` +

                  `## Position-by-Position Breakdown\n\n` +
                  comparison.position_analysis.map(formatPositionAnalysis).join('\n') +

                  `\n## Team Rankings by Overall Strength\n\n` +
                  comparison.team_rankings.map(formatTeamRanking).join('\n') +

                  `\n## 🎯 Priority Recommendations\n\n` +
                  (comparison.overall_recommendations.length > 0 ?
                    comparison.overall_recommendations.map(rec =>
                      `**${rec.position}**: ${rec.reason}\n` +
                      `  - Affected teams: ${rec.affected_teams.join(', ')}\n`
                    ).join('\n') :
                    'Your roster composition is well-balanced across all leagues!\n') +

                  `\n## 🚀 Action Items\n` +
                  `- **Waiver Priority**: Target ${comparison.overall_recommendations.slice(0, 2).map(r => r.position).join(', ') || 'depth at skill positions'}\n` +
                  `- **Trade Focus**: Use depth from strongest teams to improve weakest teams\n` +
                  `- **Attention Priority**: Focus lineup optimization on your strongest teams first\n\n` +
                  `💡 **Pro Tip**: Consider cross-league trades if your leagues allow it, or use this analysis to prioritize which leagues get your attention during busy weeks.`
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to get multi-roster analysis: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Format all rosters in a league as a summary view
   * Useful for evaluating matchups and trade opportunities
   */
  private async formatAllRosters(
    league: SleeperLeague,
    rosters: SleeperRoster[],
    users: SleeperUser[],
    userId: string
  ) {
    // Limit to 16 teams max
    const rostersToShow = rosters.slice(0, 16);

    // Enrich all rosters with player data and owner info
    const enrichedRosterData = await Promise.all(
      rostersToShow.map(async (roster) => {
        const owner = users.find(u => u.user_id === roster.owner_id);
        const ownerName = owner?.display_name || owner?.username || 'Unknown Owner';
        const isUserRoster = roster.owner_id === userId;

        // Get all unique player IDs
        const allPlayerIds = Array.from(new Set([...(roster.players || []), ...(roster.starters || [])]));

        if (allPlayerIds.length === 0) {
          return {
            roster,
            ownerName,
            isUserRoster,
            enrichedPlayers: [],
            starters: [],
            bench: [],
            keyPlayers: []
          };
        }

        // Enrich players
        const enrichedPlayers = await this.enrichPlayers(allPlayerIds, roster.starters || []);
        const starters = enrichedPlayers.filter(p => p.is_starter);
        const bench = enrichedPlayers.filter(p => !p.is_starter);

        // Get key players (top 3 starters by position importance: QB > RB > WR > TE)
        const positionPriority: { [key: string]: number } = {
          'QB': 1, 'RB': 2, 'WR': 3, 'TE': 4, 'K': 5, 'DEF': 6
        };

        const keyPlayers = starters
          .sort((a, b) => {
            const aPriority = positionPriority[a.position] || 99;
            const bPriority = positionPriority[b.position] || 99;
            return aPriority - bPriority;
          })
          .slice(0, 3);

        // Calculate roster strength based on depth
        const positions = this.groupPlayersByPosition(enrichedPlayers, league.roster_positions);
        const avgDepthScore = positions.reduce((sum, pos) => sum + pos.depth_score, 0) / positions.length;
        const strongPositions = positions.filter(pos => pos.strength === 'Strong').length;
        const weakPositions = positions.filter(pos => pos.strength === 'Weak').length;

        let overallStrength: 'Strong' | 'Average' | 'Weak';
        if (strongPositions >= 4 && weakPositions <= 1) {
          overallStrength = 'Strong';
        } else if (weakPositions >= 3) {
          overallStrength = 'Weak';
        } else {
          overallStrength = 'Average';
        }

        return {
          roster,
          ownerName,
          isUserRoster,
          enrichedPlayers,
          starters,
          bench,
          keyPlayers,
          overallStrength
        };
      })
    );

    // Sort by standings (wins, then points)
    enrichedRosterData.sort((a, b) => {
      const aWins = a.roster.settings.wins;
      const bWins = b.roster.settings.wins;
      if (aWins !== bWins) return bWins - aWins;

      return b.roster.settings.fpts - a.roster.settings.fpts;
    });

    // Format output
    const strengthEmoji = { 'Strong': '💪', 'Average': '⚖️', 'Weak': '⚠️' };

    const teamSummaries = enrichedRosterData.map((data, index) => {
      const { roster, ownerName, isUserRoster, keyPlayers, overallStrength } = data;
      const userIndicator = isUserRoster ? ' ⭐ (You)' : '';

      const keyPlayersText = keyPlayers.length > 0
        ? keyPlayers.map(p => `${p.full_name} (${p.position})`).join(', ')
        : 'No starters';

      const winPct = roster.settings.wins / (roster.settings.wins + roster.settings.losses || 1) * 100;

      return `${index + 1}. **${ownerName}${userIndicator}** (Roster #${roster.roster_id})\n` +
             `   - Record: ${roster.settings.wins}-${roster.settings.losses}-${roster.settings.ties} (${winPct.toFixed(0)}%) | ` +
             `Points: ${roster.settings.fpts.toFixed(1)}\n` +
             `   - Key Players: ${keyPlayersText}\n` +
             `   - Roster Strength: ${strengthEmoji[overallStrength || 'Average']} ${overallStrength || 'Average'}\n`;
    });

    // Find user's roster
    const userRosterData = enrichedRosterData.find(d => d.isUserRoster);
    const userRank = userRosterData ? enrichedRosterData.indexOf(userRosterData) + 1 : 'N/A';
    const userRecord = userRosterData
      ? `${userRosterData.roster.settings.wins}-${userRosterData.roster.settings.losses}-${userRosterData.roster.settings.ties}`
      : 'N/A';

    return {
      content: [
        {
          type: 'text',
          text: `# ${league.name} - All Rosters\n\n` +
                `**Total Teams:** ${rostersToShow.length}${rosters.length > 16 ? ' (showing first 16)' : ''}\n` +
                `**Your Ranking:** #${userRank} (${userRecord})\n\n` +
                `## Team Rankings\n\n` +
                teamSummaries.join('\n') +
                `\n---\n\n` +
                `💡 **Tip:** Use a specific roster_id to see detailed player information for any team, ` +
                `or omit roster_id to see only your roster.`
        }
      ]
    };
  }

  /**
   * Get detailed roster for a specific league
   * Shows starters, bench, and player status information
   * Can show user's roster, specific roster by ID, or all rosters
   */
  async getLeagueRoster(leagueId: string, rosterId?: number) {
    try {
      const userId = process.env.SLEEPER_USER_ID;

      if (!userId) {
        throw new Error('User ID not configured');
      }

      // Fetch league info, rosters, and users in parallel
      const [league, rosters, users] = await Promise.all([
        this.sleeperAPI.getLeague(leagueId),
        this.sleeperAPI.getLeagueRosters(leagueId),
        this.sleeperAPI.getLeagueUsers(leagueId)
      ]);

      // Check if roster_id is 0 (show all rosters)
      if (rosterId === 0) {
        return this.formatAllRosters(league, rosters, users, userId);
      }

      // Find target roster
      let targetRoster: SleeperRoster | undefined;

      if (rosterId !== undefined) {
        // Find specific roster by ID
        targetRoster = rosters.find(roster => roster.roster_id === rosterId);

        if (!targetRoster) {
          const validIds = rosters.map(r => r.roster_id).sort((a, b) => a - b).join(', ');
          return {
            content: [
              {
                type: 'text',
                text: `# ${league.name}\n\n` +
                      `❌ **Roster #${rosterId} not found in this league.**\n\n` +
                      `Valid roster IDs: ${validIds}\n\n` +
                      `Use roster_id: 0 to see all rosters.`
              }
            ]
          };
        }
      } else {
        // Find user's roster
        targetRoster = rosters.find(roster => roster.owner_id === userId);
      }

      const userRoster = targetRoster;

      if (!userRoster) {
        const message = rosterId !== undefined
          ? `❌ **Roster #${rosterId} not found or has no owner.**`
          : `❌ **You are not a member of this league.**\n\n` +
            `If you believe this is an error, please verify your SLEEPER_USER_ID configuration.`;

        return {
          content: [
            {
              type: 'text',
              text: `# ${league.name}\n\n${message}`
            }
          ]
        };
      }

      // Get owner display name
      const owner = users.find(u => u.user_id === userRoster.owner_id);
      const ownerName = owner?.display_name || owner?.username || 'Unknown Owner';

      // Check if roster has players
      if (!userRoster.players || userRoster.players.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `# ${league.name} - Your Roster\n\n` +
                    `**Record:** ${userRoster.settings.wins}-${userRoster.settings.losses}-${userRoster.settings.ties}\n` +
                    `**Roster ID:** #${userRoster.roster_id}\n\n` +
                    `📭 **Your roster is empty.**\n\n` +
                    `This league may be in pre-draft status or you haven't drafted yet.`
            }
          ]
        };
      }

      // Get all unique player IDs
      const allPlayerIds = Array.from(new Set([...userRoster.players, ...(userRoster.starters || [])]));

      // Enrich players with details
      const enrichedPlayers = await this.enrichPlayers(allPlayerIds, userRoster.starters || []);

      // Separate starters and bench
      const starters = enrichedPlayers.filter(p => p.is_starter);
      const bench = enrichedPlayers.filter(p => !p.is_starter);

      // Helper function to get status emoji
      const getStatusEmoji = (status: string): string => {
        switch (status) {
          case 'Active': return '🟢';
          case 'Questionable': return '⚠️';
          case 'Doubtful': return '🟠';
          case 'Out': return '🔴';
          case 'IR': return '🔴';
          case 'PUP': return '🔴';
          case 'Inactive': return '⚫';
          default: return '⚪';
        }
      };

      // Helper function to group and format players by position
      const formatPlayersByPosition = (players: EnrichedRosterPlayer[], title: string): string => {
        if (players.length === 0) {
          return `## ${title}\n\n_No players_\n\n`;
        }

        // Group by position
        const positions = ['QB', 'RB', 'WR', 'TE', 'FLEX', 'K', 'DEF'];
        const grouped: { [key: string]: EnrichedRosterPlayer[] } = {};

        // Initialize position groups
        positions.forEach(pos => {
          grouped[pos] = [];
        });

        // Add players to their position groups
        players.forEach(player => {
          const pos = player.position;
          if (grouped[pos]) {
            grouped[pos].push(player);
          } else {
            // For FLEX or unknown positions
            if (!grouped['FLEX']) {
              grouped['FLEX'] = [];
            }
            grouped['FLEX'].push(player);
          }
        });

        let output = `## ${title}\n\n`;

        // Format each position group
        positions.forEach(position => {
          if (grouped[position] && grouped[position].length > 0) {
            output += `### ${position}\n`;
            grouped[position].forEach(player => {
              output += `- ${getStatusEmoji(player.status)} ${player.full_name} (${player.team}) - ${player.status}\n`;
            });
            output += '\n';
          }
        });

        return output;
      };

      // Format the response
      const startersSection = formatPlayersByPosition(starters, '🏈 Starters');
      const benchSection = formatPlayersByPosition(bench, '📋 Bench');

      const isUserRoster = userRoster.owner_id === userId;
      const rosterTitle = isUserRoster ? 'Your Roster' : `${ownerName}'s Roster`;

      return {
        content: [
          {
            type: 'text',
            text: `# ${league.name} - ${rosterTitle}\n\n` +
                  `**Owner:** ${ownerName}\n` +
                  `**Record:** ${userRoster.settings.wins}-${userRoster.settings.losses}-${userRoster.settings.ties} | ` +
                  `**Points For:** ${userRoster.settings.fpts.toFixed(1)} | ` +
                  `**Roster ID:** #${userRoster.roster_id}\n\n` +
                  startersSection +
                  benchSection +
                  `---\n\n` +
                  `**Total Roster:** ${enrichedPlayers.length} players | ` +
                  `**Starters:** ${starters.length} | ` +
                  `**Bench:** ${bench.length}`
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to get league roster: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Manage player cache - useful for debugging and maintenance
   */
  async managePlayerCache(action: 'status' | 'refresh' | 'clear' = 'status') {
    try {
      switch (action) {
        case 'status': {
          const status = await this.sleeperAPI.getPlayerCacheStatus();
          return {
            content: [
              {
                type: 'text',
                text: `# Player Cache Status\n\n` +
                      `**Exists:** ${status.exists ? 'Yes' : 'No'}\n` +
                      `**Last Updated:** ${status.lastUpdated ? status.lastUpdated.toLocaleString() : 'Never'}\n` +
                      `**Is Expired:** ${status.isExpired ? 'Yes' : 'No'}\n` +
                      `**Player Count:** ${status.playerCount.toLocaleString()}\n` +
                      `**File Size:** ${status.fileSizeMB.toFixed(1)} MB\n\n` +

                      (status.isExpired ?
                        `⚠️ **Cache is expired** - Next roster analysis will fetch fresh data from Sleeper API\n` :
                        `✅ **Cache is current** - Roster analysis will use cached player data\n`) +

                      `\n💡 **Note**: Player data is cached for 24 hours to comply with Sleeper API guidelines`
              }
            ]
          };
        }

        case 'refresh': {
          await this.sleeperAPI.refreshPlayerCache();
          return {
            content: [
              {
                type: 'text',
                text: `# Player Cache Refreshed\n\n` +
                      `✅ **Cache cleared** - Next roster analysis will fetch fresh data from Sleeper API\n\n` +
                      `This will trigger a ~5MB download from Sleeper the next time roster analysis runs.`
              }
            ]
          };
        }

        case 'clear': {
          await this.sleeperAPI.refreshPlayerCache();
          return {
            content: [
              {
                type: 'text',
                text: `# Player Cache Cleared\n\n` +
                      `🗑️ **Cache files removed** - Next roster analysis will fetch fresh data\n\n` +
                      `Use this if you're experiencing issues with player data or want to force a refresh.`
              }
            ]
          };
        }

        default:
          throw new Error('Invalid cache action. Use: status, refresh, or clear');
      }
    } catch (error) {
      throw new Error(`Failed to manage player cache: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get waiver wire targets across all leagues
   * Analyzes available players and prioritizes based on roster needs and multi-league availability
   */
  async getWaiverTargets(position?: string, limit: number = 5) {
    try {
      const configuredSeason = process.env.NFL_SEASON || '2025';
      const userId = process.env.SLEEPER_USER_ID;

      if (!userId) {
        throw new Error('User ID not configured');
      }

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

      // Fetch all rosters across all leagues in parallel
      const leagueRosterData = await Promise.all(
        leagues.map(async (league) => {
          try {
            const rosters = await this.sleeperAPI.getLeagueRosters(league.league_id);
            const userRoster = rosters.find(roster => roster.owner_id === userId);

            // Get all rostered players in this league
            const rosteredPlayerIds = new Set<string>();
            rosters.forEach(roster => {
              roster.players.forEach(playerId => rosteredPlayerIds.add(playerId));
            });

            return {
              league,
              userRoster,
              rosteredPlayerIds,
              allRosters: rosters
            };
          } catch (error) {
            return null;
          }
        })
      );

      const validLeagueData = leagueRosterData.filter((data): data is NonNullable<typeof data> => data !== null);

      // Get all players from the database
      const allPlayers = await this.sleeperAPI.getPlayers();
      const playerArray = Array.from(allPlayers.values());

      // Fetch trending players (most added in last 24 hours)
      const trendingAdds = await this.sleeperAPI.getTrendingPlayers('add', 24, 100);
      const trendingMap = new Map<string, number>();
      trendingAdds.forEach(({ player_id, count }) => {
        trendingMap.set(player_id, count);
      });

      console.error(`Fetched ${trendingAdds.length} trending players`);

      // Filter to only active NFL players in relevant positions
      const positions = position ? [position] : ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

      // First, collect all rostered player IDs across all leagues to understand who's taken
      const allRosteredPlayerIds = new Set<string>();
      validLeagueData.forEach(({ rosteredPlayerIds }) => {
        rosteredPlayerIds.forEach(id => allRosteredPlayerIds.add(id));
      });

      // Get a sample of rostered players to understand scoring relevance
      const rosteredPlayers = playerArray.filter(player => allRosteredPlayerIds.has(player.player_id));

      // Create a whitelist of relevant NFL teams (active teams only)
      const activeNFLTeams = new Set([
        'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE', 'DAL', 'DEN',
        'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC', 'LAC', 'LAR', 'LV', 'MIA',
        'MIN', 'NE', 'NO', 'NYG', 'NYJ', 'PHI', 'PIT', 'SEA', 'SF', 'TB',
        'TEN', 'WAS'
      ]);

      const relevantPlayers = playerArray.filter(player => {
        // Must have valid position
        const hasValidPosition = positions.some(pos =>
          player.position === pos || player.fantasy_positions?.includes(pos)
        );
        if (!hasValidPosition) return false;

        // Must be on an active NFL team
        if (!player.team || !activeNFLTeams.has(player.team)) return false;

        // Must be Active or Questionable status (healthy enough to play)
        if (player.status !== 'Active' && player.status !== 'Questionable') return false;

        // For skill positions, require years_exp data or injury_status to filter out practice squad
        // This is a heuristic to focus on rostered NFL players
        if (player.position === 'QB' || player.position === 'RB' ||
            player.position === 'WR' || player.position === 'TE') {
          // If player has no fantasy_positions array, likely not fantasy-relevant
          if (!player.fantasy_positions || player.fantasy_positions.length === 0) return false;
        }

        return true;
      });

      // Analyze each player's availability across leagues
      const waiverTargets: WaiverPlayerTarget[] = relevantPlayers
        .map(player => {
          const availableInLeagues: string[] = [];
          const recommendedFor: string[] = [];

          validLeagueData.forEach(({ league, userRoster, rosteredPlayerIds }) => {
            // Check if player is available (not rostered by anyone)
            if (!rosteredPlayerIds.has(player.player_id)) {
              availableInLeagues.push(league.name);

              // Check if user needs this position
              if (userRoster) {
                const userPlayerIds = userRoster.players || [];
                const enrichedPlayers = userPlayerIds.map(id => allPlayers.get(id)).filter(p => p !== undefined);

                const positionPlayers = enrichedPlayers.filter(p =>
                  p.position === player.position || p.fantasy_positions?.includes(player.position)
                );

                // Recommend if user has fewer than 3 players at this position (simplified depth check)
                if (positionPlayers.length < 3) {
                  recommendedFor.push(league.name);
                }
              }
            }
          });

          // Calculate priority score
          // Higher score = better target
          let priorityScore = 0;

          // TRENDING DATA (MOST IMPORTANT)
          const trendingCount = trendingMap.get(player.player_id) || 0;
          if (trendingCount > 0) {
            // Heavily weight trending players
            // Players with 100+ adds get 1000+ points, making them top priorities
            priorityScore += trendingCount * 10;
          }

          // Available in multiple leagues = higher value
          priorityScore += availableInLeagues.length * 10;

          // Needed for roster depth = higher value
          priorityScore += recommendedFor.length * 15;

          // Active status = higher value than questionable
          if (player.status === 'Active') {
            priorityScore += 5;
          }

          // Position scarcity adjustments
          if (player.position === 'RB' || player.position === 'WR') {
            priorityScore += 3; // These positions have more value
          } else if (player.position === 'TE') {
            priorityScore += 5; // TE is scarce
          }

          return {
            player_id: player.player_id,
            full_name: player.full_name || `${player.first_name} ${player.last_name}`,
            position: player.position,
            team: player.team,
            status: player.status as any,
            fantasy_positions: player.fantasy_positions || [player.position],
            available_in_leagues: availableInLeagues,
            league_count: availableInLeagues.length,
            priority_score: priorityScore,
            recommended_for: recommendedFor,
            trending_add_count: trendingCount > 0 ? trendingCount : undefined
          };
        })
        .filter(target => target.available_in_leagues.length > 0); // Only show players available somewhere

      // Group by position
      const positionGroups: { [key: string]: WaiverPlayerTarget[] } = {};
      positions.forEach(pos => {
        positionGroups[pos] = waiverTargets
          .filter(target => target.position === pos || target.fantasy_positions.includes(pos))
          .sort((a, b) => b.priority_score - a.priority_score)
          .slice(0, limit);
      });

      // Format output
      const formatPlayerTarget = (target: WaiverPlayerTarget): string => {
        const availableCount = target.league_count;
        const recommendedCount = target.recommended_for.length;
        const trending = target.trending_add_count || 0;

        let recommendation = '';
        if (trending > 50) {
          recommendation = ` 🔥 **TRENDING HOT** (${trending} adds across Sleeper)`;
        } else if (trending > 10) {
          recommendation = ` ⬆️ **Trending Up** (${trending} adds)`;
        } else if (recommendedCount > 0) {
          recommendation = ` 🎯 **Fills roster need** (depth in ${recommendedCount} league${recommendedCount > 1 ? 's' : ''})`;
        } else if (availableCount >= 2) {
          recommendation = ` 📌 Multi-league option`;
        }

        let leaguesText = `Available in ${availableCount} league${availableCount > 1 ? 's' : ''}`;
        if (availableCount <= 3) {
          leaguesText += `: ${target.available_in_leagues.join(', ')}`;
        } else {
          leaguesText += `: ${target.available_in_leagues.slice(0, 2).join(', ')} +${availableCount - 2} more`;
        }

        return `- **${target.full_name}** (${target.team})${recommendation}\n` +
               `  - ${leaguesText}\n` +
               `  - Status: ${target.status}${trending > 0 ? ` | Trending: ${trending} adds in 24h` : ''} | Score: ${target.priority_score}`;
      };

      // Count total unique available players
      const totalAvailablePlayers = waiverTargets.length;

      let outputText = `# Waiver Wire Targets Analysis\n\n`;
      outputText += `**Leagues Analyzed:** ${validLeagueData.length}\n`;
      outputText += `**Position Filter:** ${position || 'All Positions'}\n`;
      outputText += `**Total Available Players Found:** ${totalAvailablePlayers}\n\n`;

      // Show league names for reference
      if (validLeagueData.length > 0) {
        outputText += `**Your Leagues:**\n`;
        validLeagueData.forEach(({ league }, idx) => {
          outputText += `${idx + 1}. ${league.name}\n`;
        });
        outputText += '\n';
      }

      // Show analysis for each position
      positions.forEach(pos => {
        const targets = positionGroups[pos];
        if (targets && targets.length > 0) {
          outputText += `## ${pos} Targets (Top ${Math.min(limit, targets.length)} of ${waiverTargets.filter(t => t.position === pos).length} available)\n\n`;
          targets.forEach(target => {
            outputText += formatPlayerTarget(target) + '\n\n';
          });
        } else {
          outputText += `## ${pos} Targets\n\n_No available players found at this position_\n\n`;
        }
      });

      // Add HOTTEST TRENDING section FIRST (most important!)
      const trendingTargets = waiverTargets
        .filter(target => (target.trending_add_count || 0) > 5)
        .sort((a, b) => (b.trending_add_count || 0) - (a.trending_add_count || 0))
        .slice(0, 10);

      if (trendingTargets.length > 0) {
        outputText += `## 🔥 HOTTEST ADDS (Last 24 Hours)\n\n`;
        outputText += `These players are being added heavily across Sleeper right now:\n\n`;
        trendingTargets.forEach(target => {
          const trending = target.trending_add_count || 0;
          const availableIn = target.available_in_leagues.length > 0
            ? ` - Available in: ${target.available_in_leagues.slice(0, 2).join(', ')}${target.available_in_leagues.length > 2 ? '...' : ''}`
            : ' - NOT available in your leagues';
          outputText += `- **${target.full_name}** (${target.position}, ${target.team}) - **${trending} adds**${availableIn}\n`;
        });
        outputText += '\n';
      }

      // Add recommendations section
      const highPriorityTargets = waiverTargets
        .filter(target => target.recommended_for.length > 0)
        .sort((a, b) => b.priority_score - a.priority_score)
        .slice(0, 5);

      if (highPriorityTargets.length > 0) {
        outputText += `## 🎯 Top Priority Recommendations\n\n`;
        outputText += `These players address roster needs in multiple leagues:\n\n`;
        highPriorityTargets.forEach(target => {
          const trending = target.trending_add_count || 0;
          outputText += `- **${target.full_name}** (${target.position}, ${target.team})${trending > 0 ? ` [${trending} adds]` : ''}\n`;
          outputText += `  - Recommended for: ${target.recommended_for.join(', ')}\n`;
        });
        outputText += '\n';
      }

      // Add multi-league opportunities
      const multiLeagueTargets = waiverTargets
        .filter(target => target.league_count >= 2)
        .sort((a, b) => b.league_count - a.league_count)
        .slice(0, 5);

      if (multiLeagueTargets.length > 0) {
        outputText += `## 📌 Multi-League Opportunities\n\n`;
        outputText += `These players are available in multiple leagues (efficiency targets):\n\n`;
        multiLeagueTargets.forEach(target => {
          outputText += `- **${target.full_name}** (${target.position}, ${target.team}) - Available in ${target.league_count} leagues\n`;
        });
        outputText += '\n';
      }

      outputText += `---\n\n`;
      outputText += `💡 **Pro Tip**: Prioritize players that appear in both "Top Priority" and "Multi-League" sections ` +
                    `to maximize your waiver claim efficiency across all your leagues.`;

      return {
        content: [
          {
            type: 'text',
            text: outputText
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to get waiver targets: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}