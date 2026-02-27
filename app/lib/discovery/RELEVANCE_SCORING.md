# Context-Aware Relevance Scoring System

## Overview
The relevance scoring system is **dynamically weighted** based on the user's **most recent message**. This ensures that the AI always prioritizes what the user wants RIGHT NOW, not what they mentioned earlier in the conversation.

## How It Works

### 1. Priority Detection (Latest Message Only)
When a user sends a message, we extract "priority place types" - explicit mentions of what they want:
- "I want to visit the ghats" → Priority: `['ghat']`
- "Show me restaurants and street food" → Priority: `['restaurant', 'food']`
- "I want temples and forts" → Priority: `['temple', 'place_of_worship', 'fort']`

### 2. Dynamic Scoring Algorithm

```
Base Score Components:
- Instagram saved place: +100 (always highest priority)
- Within 1km: +40
- Within 3km: +30
- Within 5km: +20
- Within 10km: +10
- Rating bonus: +(rating × 5), capped at +25

Context-Aware Adjustments:
- Matches priority type: +60 (HUGE boost)
- Doesn't match priority: -20 (penalty to push down)
- Matches general interest: +10 (smaller boost)
```

### 3. Example Scenarios

#### Scenario A: User asks for ghats
```
Message: "not just restaurants, but I want to visit the ghats as well!!!"
Priority: ['ghat']

Results:
- Dashashwamedh Ghat: 43 (base) + 60 (priority) = 103 ✅
- Assi Ghat: 43 (base) + 60 (priority) = 103 ✅
- Restaurant: 68 (base) - 20 (not priority) = 48 ❌
```

#### Scenario B: User switches to food
```
Message: "actually, show me the best restaurants and street food places"
Priority: ['restaurant', 'food']

Results:
- Restaurant: 68 (base) + 60 (priority) = 128 ✅
- Street food stall: 55 (base) + 60 (priority) = 115 ✅
- Dashashwamedh Ghat: 43 (base) - 20 (not priority) = 23 ❌
```

## Key Features

### 1. Context Switching
The system adapts instantly when users change focus:
- First message: "temples" → Shows temples
- Second message: "food places" → Shows restaurants
- Third message: "ghats" → Shows ghats

### 2. Penalty System
Places that DON'T match the current priority get a -20 penalty, ensuring priority places dominate the top 7 results.

### 3. Targeted Queries
When priority types are detected, we add specific Google queries:
```javascript
priorityPlaceTypes = ['ghat']
queries = [
  "ghat in banaras",
  "famous ghat banaras", 
  "best ghat banaras",
  ...regular queries
]
```

### 4. Comprehensive Logging
Every scoring decision is logged for debugging:
```
Score breakdown for "Dashashwamedh Ghat": 
  Within 4km: +20, 
  Rating 4.3: +21, 
  🎯 PRIORITY MATCH "ghat": +60 
  = 101
```

## Code Structure

### Files
1. `app/api/planner/chat/route.ts` - Extracts priority types from latest message
2. `app/lib/discovery/placeDiscovery.ts` - Implements scoring algorithm
3. `app/lib/discovery/RELEVANCE_SCORING.md` - This documentation

### Key Functions
- `extractTripInfo()` - Detects priority place types from user message
- `calculateRelevanceScore()` - Applies context-aware scoring
- `discoverPlaces()` - Orchestrates discovery with priority queries

## Debugging

### Console Logs to Watch
```
🎯 User explicitly wants: GHATS
⚡ CONTEXT-AWARE MODE: User wants ghat in latest message
⚡ PRIORITY MODE: Results will be heavily weighted toward: ghat
🎯 PRIORITY MATCH "ghat": +60
✅ Priority places (ghat): 5/7
```

### Common Issues
1. **Priority not detected**: Check if keyword is in priority detection list
2. **Wrong places showing**: Verify priority boost (+60) is being applied
3. **Penalty too harsh**: Adjust -20 penalty if needed

## Future Improvements
- Machine learning to detect implicit preferences
- User preference history across sessions
- Time-of-day based recommendations
- Seasonal adjustments
