# Quick Testing Guide - AI Code Generation

## 🚀 Quick Start (5 Minutes)

### Step 1: Add Your OpenAI API Key

Edit `.env.local` and add:
```env
OPENAI_API_KEY=sk-your-key-here
```

Get your key: https://platform.openai.com/api-keys

Then restart your dev server:
```bash
pnpm dev
```

### Step 2: Test Basic Generation

1. Open http://localhost:3000/generator
2. Click the **"Line Follower"** template card
3. Click **"Generate Code"**
4. Watch the Arduino code stream in real-time ✨
5. Click **"Test in Simulator"** → See it work virtually
6. Click **"Flash to Arduino"** → Deploy to hardware

**Expected Result**: Complete, compilable Arduino code for line following in ~5-10 seconds

---

## 🧪 Complete Test Scenarios

### Test 1: Behavior Templates (2 minutes each)

Test all 6 pre-built behaviors:

**Line Follower (➖)**
```
1. Click template → Generate
2. Check: Uses 3 line sensors (A0, A1, A2)
3. Check: Has proportional control logic
4. Test in simulator with line-following arena
```

**Obstacle Avoider (🚧)**
```
1. Click template → Generate
2. Check: Uses ultrasonic sensor (pins 9, 10)
3. Check: Has distance threshold (30cm)
4. Test in simulator with obstacle course
```

**Wall Follower (🧱)**
```
1. Click template → Generate
2. Check: Maintains 15cm distance
3. Check: Has distance-based speed control
4. Test in simulator with walls
```

**Serial Remote Control (🎮)**
```
1. Click template → Generate
2. Check: Responds to F/B/L/R/S commands
3. Check: Echoes commands back
4. Test with serial monitor
```

**Maze Solver (🌀)**
```
1. Click template → Generate
2. Check: Implements right-hand rule
3. Check: Has wall detection logic
4. Test in simulator with maze arena
```

**Light Seeker (💡)**
```
1. Click template → Generate
2. Check: Uses LDR sensors (A3, A4)
3. Check: Compares light levels
4. (Physical test only - simulator doesn't have light)
```

---

### Test 2: Context from Robot Builder (5 minutes)

**Goal**: Verify AI uses robot configuration

1. **Build a custom robot:**
   ```
   - Open /builder
   - Drag "2-Wheel Differential Drive" chassis
   - Add 2x "Standard DC Motor"
   - Add 1x "Ultrasonic Distance Sensor"
   - Add 1x "3-Sensor Line Array"
   - Click "Test" (this saves the config)
   ```

2. **Generate code with context:**
   ```
   - Should auto-redirect to /generator
   - OR manually open /generator
   - Check for green banner: "✅ Using robot config from Builder"
   - Enter prompt: "Create an obstacle avoider"
   - Click "Generate Code"
   ```

3. **Verify context awareness:**
   ```
   ✅ Code should mention your specific sensors
   ✅ Pin assignments should match component count
   ✅ Comments should reference your chassis type
   ✅ Code should be tailored to 2-wheel differential drive
   ```

---

### Test 3: Enhance Block Editor Code (5 minutes)

**Goal**: Verify AI enhances existing code

1. **Create a simple block program:**
   ```
   - Open /playground
   - Drag blocks: Move Forward → Wait → Turn Right → Stop
   - See Arduino code generate in right panel
   - Click "Enhance with AI" button
   ```

2. **Enhancement should open generator with:**
   ```
   ✅ Your block-generated code already loaded
   ✅ Blue banner: "ℹ️ Using code from Block Editor as base"
   ✅ Prompt field is empty (ready for enhancement request)
   ```

3. **Request an enhancement:**
   ```
   - Enter: "Add ultrasonic sensor to stop if obstacle detected within 20cm"
   - Click "Generate Code"
   ```

4. **Verify enhancement:**
   ```
   ✅ Original movement logic preserved
   ✅ New sensor reading function added
   ✅ Obstacle check integrated into movement
   ✅ Variable names consistent with original
   ✅ Comments explain new additions
   ```

---

### Test 4: Custom Prompts (3 minutes)

**Goal**: Verify flexible prompt handling

Try these custom prompts:

**Simple:**
```
"Make a robot that moves in a square pattern"
Expected: Forward → Right → Forward → Right (4x) → Stop
```

**Medium:**
```
"Create a robot that follows a wall on its left side, maintaining 10cm distance"
Expected: Wall-following logic with left-side sensor, 10cm threshold
```

**Complex:**
```
"Build a robot that follows a black line. If it detects an obstacle within 25cm, 
stop, turn around, and follow the line in the opposite direction"
Expected: Combined line following + obstacle detection + turnaround logic
```

**With Specifications:**
```
"Create obstacle avoider with these rules:
- Move forward at 70% speed
- If obstacle < 30cm, stop
- Turn right 90 degrees
- Check again
- If still blocked, turn left 180 degrees
- Resume forward movement"

Expected: Specific speed values, exact turning angles, step-by-step logic
```

---

### Test 5: End-to-End Workflow (10 minutes)

**Complete development cycle:**

```
┌─────────────────────────────────────────────────────────────┐
│ 1. DESIGN (2 min)                                          │
│    /builder → Assemble robot → Click "Test"                │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. GENERATE (2 min)                                         │
│    /generator → Choose behavior → Generate code             │
│    ✅ Check: "Using robot config from Builder"              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. TEST VIRTUALLY (3 min)                                   │
│    Click "Test in Simulator"                                │
│    /simulator → Code auto-loads → Click "Run"               │
│    ✅ Watch robot execute in physics simulation             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. ENHANCE (2 min)                                          │
│    Notice issue? Click "Enhance with AI"                    │
│    Describe improvement → Generate → Test again             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. DEPLOY (1 min)                                           │
│    Click "Flash to Arduino"                                 │
│    /flasher → Copy code → Open in Arduino IDE               │
│    ✅ Upload to physical robot → Test in real world         │
└─────────────────────────────────────────────────────────────┘
```

**Checklist:**
- [ ] Robot config carried through entire workflow
- [ ] Code automatically saved between components
- [ ] No manual copy-pasting required
- [ ] Each transition shows appropriate toast notification
- [ ] Final code compiles in Arduino IDE

---

## ✅ What Should Work

After testing, verify these work correctly:

### Core Functionality
- [x] Code generation completes in < 15 seconds
- [x] Streaming updates show code appearing in real-time
- [x] Generated code is valid Arduino C++ (no syntax errors)
- [x] All 6 behavior templates generate different code
- [x] Custom prompts produce relevant code
- [x] Copy and Download buttons work

### Context Awareness
- [x] Robot builder config detected and used
- [x] Block editor code detected and enhanced
- [x] Context indicators show correct status
- [x] "Clear" buttons remove context correctly

### Integration
- [x] "Test in Simulator" opens simulator with code loaded
- [x] Simulator shows toast notification about loaded code
- [x] "Flash to Arduino" opens flasher with code ready
- [x] "Enhance with AI" from block editor works
- [x] Session storage persists across page navigation

### UI/UX
- [x] Behavior templates are visually distinct
- [x] Prompt textarea is easily editable
- [x] Example prompts insert text correctly
- [x] Loading states show during generation
- [x] Error messages are clear and helpful
- [x] Workflow guidance banner shows when appropriate

---

## ❌ Common Issues & Fixes

### Issue: "OpenAI API key not configured"

**Cause**: Missing or incorrect API key

**Fix:**
```bash
# 1. Check .env.local exists in project root
ls -la .env.local

# 2. Verify key is present and correct format (starts with sk-)
cat .env.local | grep OPENAI

# 3. Restart dev server (MUST restart after env changes)
# Stop server (Ctrl+C), then:
pnpm dev
```

### Issue: Generation takes forever / times out

**Cause**: Network issue or OpenAI API slow

**Fix:**
1. Check internet connection
2. Try generating simpler prompt
3. Check OpenAI status: https://status.openai.com
4. Wait a moment and try again

### Issue: Generated code doesn't compile

**Cause**: Hardware mismatch or library missing

**Fix:**
1. Verify Arduino board type (should be Uno/Nano)
2. Check pin numbers match your physical setup
3. Install required libraries in Arduino IDE
4. Check serial monitor for runtime errors

### Issue: Robot config not detected by generator

**Cause**: Session storage cleared or didn't save

**Fix:**
1. In Builder, ensure you click "Test" before navigating
2. Don't use "Open in new tab" - use the button's navigation
3. Check browser console for errors
4. Try: `sessionStorage.getItem('xylo_robot_config')`

### Issue: Simulator doesn't load AI code

**Cause**: Session storage cleared between navigation

**Fix:**
1. Click "Test in Simulator" button (don't manually navigate)
2. Check: `sessionStorage.getItem('xylo_code')`
3. If null, regenerate code
4. Try refreshing simulator page

---

## 🎯 Success Criteria

After testing, you should be able to:

✅ Generate 6 different robot behaviors from templates  
✅ Create custom behaviors with natural language prompts  
✅ Build a robot and get code tailored to it  
✅ Enhance block editor code with AI  
✅ Test generated code in virtual simulator  
✅ Deploy to physical Arduino with one click  
✅ Complete full workflow without errors  

**If all work**: AI integration is fully functional! 🎉

**If some fail**: Check the issue above or see `AI_INTEGRATION.md` for detailed troubleshooting

---

## 📊 Performance Benchmarks

Expected performance on standard hardware:

| Metric | Target | Acceptable | Poor |
|--------|--------|------------|------|
| Generation Time | < 10s | < 20s | > 30s |
| Code Quality | Compiles | Compiles with warnings | Doesn't compile |
| Context Detection | Instant | < 1s | > 3s |
| UI Responsiveness | Smooth | Slight lag | Freezes |
| Cost per Generation | $0.01 | $0.02 | > $0.05 |

---

## 🔧 Developer Testing

For contributors/developers:

### API Testing
```bash
# Direct API test
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create a robot that moves forward",
    "targetBehavior": "obstacle-avoider"
  }'

# Should return streaming Arduino code
```

### Session Storage Inspection
```javascript
// In browser console
sessionStorage.getItem('xylo_robot_config')
sessionStorage.getItem('xylo_code')
sessionStorage.getItem('xylo_project_name')

// Clear all
sessionStorage.clear()
```

### Component Integration
```typescript
// Test robot config save from Builder
const config = generateRobotConfig(design)
console.log(config)

// Test code save from Block Editor
sessionStorage.setItem("xylo_code", arduinoCode)
console.log("Saved:", sessionStorage.getItem("xylo_code"))
```

---

**Ready to test?** Start with the Quick Start at the top! 🚀

**Need help?** See `AI_INTEGRATION.md` for complete technical documentation.

**Found a bug?** Check browser console and verify environment variables.

