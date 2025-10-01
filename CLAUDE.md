# CLAUDE.md - Sleeper MCP Server Development Guide

This guide helps Claude Code understand and develop the Sleeper MCP Server, a TypeScript-based Model Context Protocol server that connects Claude Desktop to the Sleeper fantasy football API for intelligent multi-league management.

## Project Philosophy and Goals

The Sleeper MCP Server exists to solve a specific problem: fantasy football players managing multiple leagues (typically 4-8) spend over three hours weekly on repetitive research and roster management. This project reduces that time to under one hour through AI-powered cross-league analysis.

The core philosophy is **"Ship fast, iterate faster"** - we prioritize working functionality that provides immediate value, then enhance based on actual usage patterns. The project uses AI-assisted development with Claude and GitHub Copilot, but architectural decisions remain human-driven to ensure user-centered design.

## Understanding the Architecture

### The Three-Layer Design

The project follows a clean three-layer architecture that separates concerns and makes the codebase maintainable:

**Layer 1: API Client (sleeper-api.ts)**
This layer handles all communication with Sleeper's REST API. Think of it as a translator that speaks Sleeper's language. It includes intelligent caching to avoid overwhelming Sleeper's servers with redundant requests, which is crucial when analyzing multiple leagues simultaneously. The caching system stores responses for five minutes by default, dramatically improving performance for multi-league operations.

**Layer 2: Business Logic (tools.ts)**
This is where the magic happens - raw API data gets transformed into meaningful insights. The tools layer takes information from multiple API calls, correlates it, enriches it with context, and formats it for human consumption. For example, when discovering leagues, it doesn't just list them - it calculates win percentages, identifies which leagues need attention, and sorts everything by relevance.

**Layer 3: MCP Server (index.ts)**
This layer connects everything to Claude Desktop through the Model Context Protocol. It registers tools, validates inputs, routes requests, and ensures errors are handled gracefully. The MCP server acts as the bridge between Claude's natural language queries and our fantasy football analysis tools.

### Data Flow in Practice

When a user asks Claude "What are my fantasy leagues this season?", here's what happens behind the scenes:

First, Claude recognizes this matches the `discover_user_leagues` tool and calls it through the MCP protocol. The index.ts server validates the request and routes it to SleeperTools. The tools layer calls SleeperAPI to fetch leagues, which checks its cache first. If the data isn't cached or is stale, it makes an HTTP request to Sleeper's API. The API client returns a list of leagues, which the tools layer enriches by fetching roster data for each league, calculating records and standings, and sorting everything by performance. Finally, it formats this rich analysis into readable markdown that Claude presents to the user.

This entire process happens in under three seconds for six leagues, thanks to parallel processing and intelligent caching.

## Working with TypeScript and ES Modules

### The Module System Choice

This project uses ECMAScript modules (ESM) rather than CommonJS because the MCP SDK requires it and it represents the modern JavaScript standard. You'll notice several key configurations that make this work:

In package.json, `"type": "module"` tells Node.js to treat all .js files as ES modules. In tsconfig.json, we set `"module": "ESNext"` and `"moduleResolution": "bundler"` to generate modern module code. All imports must include the .js extension even though the source files are .ts - this is because TypeScript doesn't rewrite import paths during compilation.

### Type Safety Philosophy

The project uses strict TypeScript settings including `exactOptionalPropertyTypes`, which means there's an important distinction between properties that are missing versus properties set to undefined. When you see this pattern:

```typescript
export interface EnrichedLeague extends SleeperLeague {
  user_roster_id?: number | undefined;
  user_record?: UserRecord | undefined;
}
```

The `| undefined` is intentional and required. It explicitly allows the property to be set to undefined, not just omitted. This strictness catches potential bugs at compile time.

### Import Patterns to Follow

Always use type-only imports for interfaces and types:

```typescript
import type { SleeperLeague, SleeperRoster } from './types.js';
```

This helps TypeScript optimize the compiled output by removing type imports entirely. For runtime values like classes and functions, use regular imports:

```typescript
import { SleeperAPI } from './sleeper-api.js';
```

## Key Design Patterns and Practices

### Defensive Input Validation

The MCP server receives requests from external sources (Claude Desktop), so we never trust the input structure. Every tool handler follows this pattern:

```typescript
const args = request.params.arguments;

// First check if arguments exist at all
if (!args || typeof args !== 'object') {
  throw new McpError(ErrorCode.InvalidParams, 'Missing arguments');
}

// Then validate specific required fields
const leagueId = (args as any).league_id;
if (!leagueId || typeof leagueId !== 'string') {
  throw new McpError(ErrorCode.InvalidParams, 'Invalid league_id');
}
```

This prevents runtime crashes and provides clear error messages when something goes wrong. Always validate at the boundaries where external data enters your system.

### The Caching Strategy

The caching system uses a generic pattern that works for any API call:

```typescript
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
```

This pattern separates caching logic from data fetching logic. Each API method calls `getCached` with a unique key and a fetcher function. The caching layer handles all the complexity of checking freshness, storing data, and returning it efficiently.

### Error Handling Philosophy

Errors should be informative and actionable. Instead of generic messages like "Request failed", the code provides context:

```typescript
if (error.response) {
  throw new Error(`Sleeper API Error ${error.response.status}: ${error.response.statusText}`);
} else if (error.request) {
  throw new Error('No response from Sleeper API - check your internet connection');
} else {
  throw new Error(`Request Error: ${error.message}`);
}
```

This helps users understand what went wrong and how to fix it. When developing new features, always consider: "If this fails at 2 AM, will the error message help someone debug it?"

## Development Workflow

### Building and Running

The build process compiles TypeScript to JavaScript in the dist/ directory:

```bash
npm run build      # Compile TypeScript
npm start          # Run the compiled server
npm run dev        # Development mode with hot reload using tsx
npm run clean      # Remove dist/ directory for fresh builds
```

For development, `npm run dev` watches for file changes and automatically restarts the server. This tight feedback loop makes development much faster than manually rebuilding after each change.

### Testing Your Changes

While there's no formal test framework yet, you should test manually by:

1. Building the project with `npm run build`
2. Ensuring your .env file has a valid SLEEPER_USER_ID
3. Running `npm start` to start the server
4. Opening Claude Desktop and asking test questions like "Test the Sleeper connection" or "What leagues am I in?"

When testing MCP tools, always check both success cases and error cases. Try invalid league IDs, missing parameters, and edge cases to ensure robust error handling.

### Common Development Tasks

**Adding a New MCP Tool:**
1. Add the tool definition in the ListToolsRequestSchema handler in index.ts
2. Add a case in the CallToolRequestSchema handler for execution
3. Implement the tool logic in SleeperTools class in tools.ts
4. Add necessary types to types.ts if dealing with new data structures
5. Update CLAUDE.md and README.md with the new tool

**Adding a New API Endpoint:**
1. Add the method to SleeperAPI class in sleeper-api.ts
2. Follow the caching pattern with getCached()
3. Add appropriate TypeScript types for request/response
4. Handle errors using the established error handling pattern

**Modifying Data Enrichment:**
When the tools layer transforms API data, remember that enrichment should add value without overwhelming the user. Calculate meaningful statistics, identify patterns, and prioritize information by importance. The user asked for insights, not raw data dumps.

## Multi-League Intelligence

### The Auto-Discovery Pattern

The project's killer feature is automatic league discovery. Instead of making users manually configure league IDs, we use Sleeper's `/v1/user/{user_id}/leagues/nfl/{season}` endpoint to find all their leagues automatically.

The enrichment process then fetches rosters for each league in parallel, extracts user-specific data like win-loss records, and sorts leagues by relevance. This parallel processing pattern is crucial for performance:

```typescript
const enrichedLeagues: EnrichedLeague[] = await Promise.all(
  leagues.map(async (league): Promise<EnrichedLeague> => {
    const rosters = await this.sleeperAPI.getLeagueRosters(league.league_id);
    const userRoster = rosters.find(roster => roster.owner_id === userId);
    
    return {
      ...league,
      user_roster_id: userRoster?.roster_id,
      user_record: userRoster ? {
        wins: userRoster.settings.wins,
        losses: userRoster.settings.losses,
        ties: userRoster.settings.ties,
        points_for: userRoster.settings.fpts,
        points_against: userRoster.settings.fpts_against
      } : undefined
    };
  })
);
```

Promise.all() runs all these API calls concurrently rather than sequentially, cutting response time dramatically when dealing with multiple leagues.

### Cross-League Analysis Patterns

When building tools that analyze across multiple leagues, follow these principles:

**Aggregation:** Calculate overall statistics (total wins, average points, etc.) to give users a bird's-eye view of their performance.

**Prioritization:** Identify which leagues need attention first. Close matchups matter more than blowouts. Leagues with playoff implications matter more than leagues where the user is eliminated.

**Comparison:** Show relative performance. Is a user's running back depth strong in one league but weak in another? This helps with trade decision-making.

**Contextualization:** Always consider league-specific settings. A player's value differs dramatically between standard scoring and PPR (points per reception) formats.

## Environment Configuration

### Required Environment Variables

The .env file must contain at least:

```env
SLEEPER_USER_ID=729108285776613376
NFL_SEASON=2025
CACHE_DURATION=5
```

The SLEEPER_USER_ID is the most critical - it's a numeric ID that identifies the user on Sleeper's platform. Users can find this by calling the Sleeper API with their username:

```bash
curl "https://api.sleeper.app/v1/user/USERNAME"
```

The response contains their user_id. The NFL_SEASON defaults to 2025 and determines which season's leagues to analyze. CACHE_DURATION sets how many minutes API responses stay cached.

### Claude Desktop Integration

The MCP server connects to Claude Desktop through a configuration file. On macOS, this is typically at `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "sleeper": {
      "command": "node",
      "args": ["path/to/sleeper-mcp-server/dist/index.js"],
      "env": {
        "SLEEPER_USER_ID": "your_user_id_here"
      }
    }
  }
}
```

After modifying this configuration, restart Claude Desktop completely for changes to take effect.

## Debugging and Troubleshooting

### Common Issues and Solutions

**"Cannot find module" errors:**
This usually means `npm install` wasn't run or the build failed. Try `npm install && npm run build` to ensure everything is properly set up.

**TypeScript compilation errors:**
Check that tsconfig.json has the correct module settings. The project requires `"module": "ESNext"` and `"moduleResolution": "bundler"` to work with the MCP SDK.

**"User ID not configured" error:**
The .env file is either missing or doesn't have SLEEPER_USER_ID set. Create .env based on .env.example and add your actual Sleeper user ID.

**Claude doesn't respond to fantasy questions:**
First, verify the MCP server is running with `npm start`. Then check the Claude Desktop logs (Help > Show Logs) for connection errors. Restart Claude Desktop after any configuration changes.

**API rate limit errors:**
Sleeper allows 1000 requests per minute. The caching system prevents most rate limiting, but if you're developing tools that make many API calls, consider increasing CACHE_DURATION temporarily.

### Logging and Diagnostics

The server logs to stderr (not stdout) to avoid interfering with the MCP protocol communication on stdout. When developing, you'll see log messages in your terminal. For more detailed debugging, add console.error() calls to track data flow:

```typescript
console.error('Fetching leagues for user:', userId);
console.error('Found leagues:', leagues.length);
```

These debugging statements won't interfere with the MCP protocol and help trace execution flow.

## Future Development Roadmap

### Immediate Next Steps

The foundation is complete, so the next priorities are advanced multi-league tools:

**Cross-League Matchup Analysis:**
Build a tool that fetches the current week's matchups across all leagues, identifies competitive games versus likely blowouts, and recommends which teams need the most lineup attention.

**Universal Waiver Wire Intelligence:**
Analyze available players across all leagues, identify opportunities where the same player is available in multiple leagues, and prioritize waiver claims based on roster needs.

**Multi-Roster Comparison:**
Compare roster construction across all teams, identify positional weaknesses, and suggest which leagues offer the best opportunities for improvement.

### Advanced Features

**Trade Analysis:**
Evaluate proposed trades by comparing player values, considering team needs, and accounting for league-specific scoring. This requires building valuation models that adapt to different scoring systems.

**Performance Trends:**
Track player performance over recent weeks, identify emerging breakout candidates, and flag declining players who might need to be dropped.

**Injury Integration:**
Monitor injury reports and automatically suggest replacement options when players on the user's rosters are injured.

## Code Quality Standards

### What Good Code Looks Like Here

Good code in this project is readable, well-commented, and follows established patterns. When adding new features, match the existing style and structure. Use descriptive variable names that make intent clear - `enrichedLeagues` is better than `leagues2`.

Add comments that explain the "why" behind decisions, not just the "what":

```typescript
// Sort leagues by performance and activity
// This helps users focus on leagues that need attention first
enrichedLeagues.sort((a, b) => {
  // Active leagues appear before completed ones
  if (a.status !== b.status) {
    return a.status === 'in_season' ? -1 : 1;
  }
  
  // Within active leagues, sort by win percentage
  if (a.user_record && b.user_record) {
    const aWinPct = a.user_record.wins / (a.user_record.wins + a.user_record.losses);
    const bWinPct = b.user_record.wins / (b.user_record.wins + b.user_record.losses);
    return bWinPct - aWinPct;
  }
  
  return 0;
});
```

### Performance Considerations

Always be mindful of API call volume. When analyzing multiple leagues, use Promise.all() for parallel requests rather than awaiting each call sequentially. The difference is dramatic - fetching data for six leagues takes 1-2 seconds with parallel calls versus 6-10 seconds sequentially.

Cache aggressively but not indefinitely. Five minutes is the sweet spot for most fantasy football data - it's fresh enough to be relevant but stale enough to prevent excessive API calls.

## Security and Privacy

The project handles user data responsibly. User IDs are stored locally in .env files and never transmitted except to Sleeper's API. The MCP server only communicates with Claude Desktop on the same machine - there are no external web services or data collection.

When adding new features, maintain this privacy-first approach. Don't log sensitive user data. Don't transmit data to third parties. Keep everything local and transparent.

## Getting Help and Resources

**Key Documentation:**
- [Sleeper API Documentation](https://docs.sleeper.app/) - Comprehensive reference for all API endpoints
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) - Official SDK documentation
- Project User Stories (in Obsidian notes) - Detailed requirements and use cases

**When You're Stuck:**
1. Check the Development Session Log in the Obsidian notes - it documents common issues and solutions
2. Review the Project Knowledge Base for architectural decisions and patterns
3. Test with the test_connection tool to verify basic functionality
4. Check Claude Desktop logs for MCP communication errors

Remember that this project exists to make fantasy football more enjoyable and less time-consuming. Every feature should serve that goal. Keep the user experience front and center, and don't add complexity without clear value.

When in doubt, ship something simple that works and iterate based on feedback. That's the heart of this project's philosophy.