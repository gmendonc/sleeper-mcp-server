# Sleeper MCP Server

> **Multi-League Fantasy Football Management with AI** - An MCP server that auto-discovers all your Sleeper leagues and enables Claude to provide intelligent cross-league analysis, roster optimization, and strategic decision-making.

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![MCP](https://img.shields.io/badge/MCP-Model%20Context%20Protocol-blue?style=for-the-badge)](https://github.com/modelcontextprotocol)

## 🎯 Why This Project?

**The Problem:** Managing multiple fantasy football leagues is time-consuming and repetitive. You spend hours each week analyzing rosters, checking waivers, and making decisions across 4-8 different leagues.

**The Solution:** An AI assistant that automatically discovers all your Sleeper leagues and provides intelligent cross-league analysis. Ask questions like *"Which of my 6 teams needs attention this week?"* and get instant, actionable insights.

## ✨ Key Features

### 🔍 **Automatic League Discovery**
- Just provide your Sleeper User ID
- Automatically finds all your leagues for the current season
- No manual configuration required

### 🏆 **Multi-League Intelligence**
- Cross-league roster analysis and comparisons
- Universal waiver wire recommendations
- Priority-based decision making across all teams
- Identify which leagues need the most attention

### ⚡ **Efficient Management**
- Reduce weekly management time from 3+ hours to under 1 hour
- Parallel processing of multiple league data
- Smart caching with 5-minute refresh cycles
- Never miss opportunities due to time constraints

### 🤖 **AI-Powered Insights**
- *"Which of my teams has the weakest RB depth?"*
- *"What are the best waiver pickups across all my leagues?"*
- *"Which leagues should I prioritize this week?"*
- *"Show me all my matchups and highlight the closest ones"*

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Your Sleeper User ID
- Claude Desktop

### Installation

```bash
# Clone and setup
git clone https://github.com/YOUR_USERNAME/sleeper-mcp-server.git
cd sleeper-mcp-server
npm install

# Configure (just your user ID!)
cp .env.example .env
# Edit .env and add your SLEEPER_USER_ID

# Build and start
npm run build
npm start
```

### Configuration

**Step 1:** Find your Sleeper User ID
- Go to your Sleeper profile: `https://sleeper.app/users/your_username`
- Copy the numeric ID from the URL

**Step 2:** Create `.env` file
```env
# Use the User ID you found from the API method above
SLEEPER_USER_ID=123456789
NFL_SEASON=2024
```

**Step 3:** Connect to Claude Desktop
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

**That's it!** The server will automatically discover all your leagues.

## 🛠️ MCP Tools

| Tool | Purpose | Example Question |
|------|---------|------------------|
| `discover_user_leagues` | Find all user's leagues automatically | *"What leagues am I in this season?"* |
| `get_all_leagues_summary` | Cross-league performance overview | *"How are all my teams doing?"* |
| `get_cross_league_matchups` | Multi-league matchup analysis | *"Which matchups are closest this week?"* |
| `get_universal_waiver_targets` | Best pickups across all leagues | *"What are the top waiver wire targets?"* |
| `get_multi_roster_analysis` | Comparative roster analysis | *"Which team has the weakest RB depth?"* |
| `get_league_specific_info` | Deep dive into single league | *"Tell me about my work league team"* |
| `set_league_preferences` | Customize league priorities | *"Set my work league as high priority"* |

## 💬 Example Conversations

### League Discovery
**You:** *"What fantasy leagues am I in this season?"*

**Claude:** *"I found 4 active leagues for you this season:
- Work League (12 teams, 6-2 record)
- Friends & Family (10 teams, 5-3 record)  
- High Stakes Dynasty (12 teams, 4-4 record)
- College Buddies (8 teams, 7-1 record)

Your College Buddies team is performing best. Would you like me to analyze any specific league?"*

### Multi-League Analysis
**You:** *"Which of my teams needs the most attention this week?"*

**Claude:** *"Based on matchups and roster needs:

**High Priority:**
- High Stakes Dynasty: Tough matchup vs league leader, weak at RB with injury concerns
- Work League: Close projected game, opportunity to gain ground on playoff race

**Medium Priority:**  
- Friends & Family: Favorable matchup, roster looks solid

**Low Priority:**
- College Buddies: Easy matchup, deep roster, likely win

Focus your waiver claims and lineup decisions on the High Stakes and Work leagues this week."*

### Waiver Wire Intelligence
**You:** *"What are the best waiver wire pickups across all my leagues?"*

**Claude:** *"Top targets by league:

**Universal Targets (available in multiple leagues):**
- RB Roschon Johnson (CHI) - Available in 3/4 leagues, becoming goal-line back
- WR Wan'Dale Robinson (NYG) - Available in 2/4 leagues, increasing target share

**League-Specific Opportunities:**
- Work League: QB Tyson Bagent (CHI) - Great matchup, your opponent has QB on bye
- High Stakes: RB Kareem Hunt (CLE) - Handcuff for your Nick Chubb investment

**Recommendations:**
1. Prioritize Johnson in High Stakes (biggest roster need)
2. Grab Robinson in Work & Friends leagues
3. Consider Bagent as streaming option if you need QB help"*

## 📁 Project Structure

```
sleeper-mcp-server/
├── src/
│   ├── index.ts           # MCP server entry point
│   ├── sleeper-api.ts     # Sleeper API client with multi-league support
│   ├── discovery.ts       # Auto-discovery service
│   ├── tools.ts           # MCP tools implementation
│   ├── cache.ts           # Multi-league caching system
│   └── types.ts           # TypeScript interfaces
├── .env                   # Your Sleeper user ID
├── preferences.json       # Optional league customizations
├── package.json
├── tsconfig.json
└── README.md
```

## ⚙️ Advanced Configuration

### Optional Preferences

Create `preferences.json` to customize discovered leagues:

```json
{
  "league_preferences": {
    "123456789": {
      "nickname": "work",
      "priority": "high",
      "category": "competitive"
    },
    "987654321": {
      "nickname": "family",
      "priority": "low",
      "exclude_from_analysis": true
    }
  },
  "settings": {
    "max_concurrent_requests": 5,
    "auto_refresh_interval_minutes": 30
  }
}
```

### Environment Variables

```env
# Required
SLEEPER_USER_ID=your_user_id_here

# Optional
NFL_SEASON=2024                    # Defaults to current season
CACHE_DURATION=5                   # Minutes, default 5
NODE_ENV=development
```

## 📈 Performance & Efficiency

- **Response Time:** < 3 seconds for multi-league queries
- **API Efficiency:** Parallel processing with intelligent rate limiting
- **Memory Usage:** < 200MB for 6+ leagues
- **Caching:** Smart 5-minute refresh with cross-league optimization
- **Scalability:** Efficiently handles 4-8 leagues per user

## 🎯 Multi-League Workflow

### Sunday Evening (15 minutes)
1. *"How did all my teams do this week?"*
2. *"Which leagues need attention for next week?"*
3. *"What waiver claims should I prioritize?"*

### Tuesday Waiver Day (20 minutes)
1. *"Show me the best waiver targets across all leagues"*
2. *"Which leagues should I focus my claims on?"*
3. *"Set my waiver priorities for each team"*

### Mid-Week Management (10 minutes)
1. *"Any trade opportunities worth exploring?"*
2. *"Which teams have difficult start/sit decisions?"*
3. *"Update me on any player news affecting my teams"*

## 🧪 Development

### Commands

```bash
npm run dev          # Development with hot reload
npm run build        # Production build
npm run start        # Start production server
npm test             # Run tests
npm run lint         # Code linting
```

### Testing

```bash
# Test with your actual data
npm run test:discovery    # Test league auto-discovery
npm run test:multi        # Test multi-league tools
npm run test:integration  # Test Claude Desktop integration
```

## 🗺️ Roadmap

### Week 2 Enhancements
- [ ] Player performance trends and analytics
- [ ] Trade analysis across leagues
- [ ] Injury report integration
- [ ] Advanced start/sit recommendations

### Future Features
- [ ] Machine learning for player projections
- [ ] Historical performance analysis  
- [ ] Support for other fantasy platforms
- [ ] Mobile app companion

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'feat: add amazing feature'`
4. Push branch: `git push origin feature/amazing-feature`
5. Open Pull Request

### Development Philosophy

This project leverages AI-assisted development with Claude and GitHub Copilot. We focus on:
- Clean, maintainable TypeScript code
- Comprehensive error handling
- Efficient API usage and caching
- User-centered design

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🆘 Support

### Common Issues

**Q: "No leagues found for my user ID"**
- Verify your user ID is correct (numeric value from Sleeper profile URL)
- Ensure you have active leagues for the current season
- Check that the NFL_SEASON matches your league season

**Q: "Claude isn't responding to fantasy questions"**
- Verify MCP server is running: `npm start`
- Check Claude Desktop MCP configuration
- Restart Claude Desktop after configuration changes

**Q: "API rate limit errors"**
- Server handles rate limiting automatically
- If persistent, increase CACHE_DURATION in .env
- Restart server to reset cache

### Getting Help

- **GitHub Issues:** Bug reports and feature requests
- **Discussions:** Questions and community support
- **Documentation:** Check `/docs` for detailed guides

## 🏁 Success Checklist

- [ ] Clone repository and install dependencies
- [ ] Find your Sleeper User ID
- [ ] Configure `.env` with your user ID
- [ ] Build and start the MCP server
- [ ] Add to Claude Desktop configuration
- [ ] Test: *"What leagues am I in this season?"*
- [ ] Ask: *"How are all my teams doing this week?"*
- [ ] Start dominating with AI-powered multi-league insights! 🏆

---

**Ready to revolutionize your fantasy football management?** This MCP server turns Claude into your personal fantasy football analyst across all your leagues. No more manual tracking, no more missed opportunities - just intelligent, AI-powered decisions that help you win more games.

*Built with ❤️ for the multi-league fantasy football community*