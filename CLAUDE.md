# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Build and Run
```bash
npm run build      # Compile TypeScript to JavaScript in dist/
npm start          # Run the production build
npm run dev        # Development mode with hot reload using tsx
npm run clean      # Remove dist/ directory
```

### Testing Setup
Currently no test framework is configured - check with user if tests are needed.

## Architecture Overview

This is a **Model Context Protocol (MCP) server** that connects Claude to the Sleeper fantasy football API. The server acts as a bridge between Claude Desktop and Sleeper's API, enabling AI-powered multi-league fantasy football management.

### Core Architecture Pattern
- **MCP Server**: Uses `@modelcontextprotocol/sdk` to handle Claude Desktop communication via stdio
- **API Layer**: `SleeperAPI` class handles all Sleeper API interactions with caching
- **Tools Layer**: `SleeperTools` class implements MCP tools that Claude can call
- **Type Safety**: Comprehensive TypeScript interfaces define all data structures

### Key Components

**src/index.ts** - Main MCP server entry point
- Initializes `SleeperMCPServer` class
- Sets up stdio transport for Claude Desktop communication
- Registers MCP tools and handles tool execution requests
- Validates environment configuration (requires `SLEEPER_USER_ID`)

**src/sleeper-api.ts** - Sleeper API client with intelligent caching
- Axios-based HTTP client with 10s timeout and error handling
- In-memory caching system with configurable expiration (default 5 minutes)
- Core methods: `getUserLeagues()`, `getLeague()`, `getLeagueRosters()`, `getMatchups()`
- Handles rate limiting and provides informative error messages

**src/tools.ts** - MCP tools implementation
- `getLeagueInfo()`: Comprehensive league analysis with scoring settings and statistics
- `discoverUserLeagues()`: Auto-discovers all user leagues with enriched data and performance sorting
- Returns formatted responses with markdown for Claude Desktop display

**src/types.ts** - TypeScript definitions
- Sleeper API data structures (`SleeperLeague`, `SleeperRoster`, `SleeperPlayer`, etc.)
- Enriched types for analysis (`EnrichedLeague` with user-specific data)
- Configuration and caching interfaces

### Configuration

**Environment Variables** (.env file):
```env
SLEEPER_USER_ID=123456789    # Required - numeric user ID from Sleeper profile URL
NFL_SEASON=2025             # Optional - defaults to 2025
CACHE_DURATION=5            # Optional - cache expiration in minutes
```

**Claude Desktop Integration** (claude_desktop_config.json):
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

### Data Flow

1. **User Query**: User asks Claude about fantasy football leagues
2. **MCP Tool Call**: Claude calls appropriate MCP tool (e.g., `discover_user_leagues`)
3. **API Request**: Tool uses `SleeperAPI` to fetch data from Sleeper's API
4. **Caching**: API responses cached in-memory to reduce API calls
5. **Data Enrichment**: Raw API data enhanced with user-specific analysis
6. **Response Formatting**: Data formatted as markdown for Claude Desktop display

### Multi-League Intelligence

The core value proposition is **cross-league analysis**:
- Auto-discovery of all user leagues using just the user ID
- Parallel data fetching with intelligent caching
- Comparative analysis across multiple leagues
- Performance-based sorting and prioritization
- Unified waiver wire and roster analysis

### Current Tool Capabilities

1. **test_connection**: Validates API connectivity and configuration
2. **get_league_info**: Detailed league analysis including scoring settings, roster requirements, and statistics
3. **discover_user_leagues**: Comprehensive league discovery with user records, sorted by performance

### Adding New Tools

When adding new MCP tools:
1. Add tool definition to `ListToolsRequestSchema` handler in `index.ts`
2. Add case to `CallToolRequestSchema` handler for tool execution
3. Implement tool logic in `SleeperTools` class in `tools.ts`
4. Add necessary type definitions to `types.ts`
5. Rebuild with `npm run build` before testing

### Error Handling

- API errors are caught and converted to user-friendly messages
- Missing configuration throws startup errors
- Tool execution errors are wrapped and returned as MCP error responses
- Network timeouts handled gracefully with fallback messaging