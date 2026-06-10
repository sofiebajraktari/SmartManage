# 🤖 SmartManage AI Integration Guide

## Security update

Frontend-i nuk duhet te mbaje `OPENAI_API_KEY` ose Google secrets. Projekti tani perdor
Supabase Edge Function `openai-chat` si gateway:

```bash
supabase secrets set OPENAI_API_KEY="sk-your-key-here"
supabase secrets set OPENAI_MODEL="gpt-4o-mini"
supabase secrets set GOOGLE_VISION_API_KEY="your-google-vision-api-key"
supabase functions deploy openai-chat
supabase functions deploy vision-ocr
```

Ne `.env`/Render Static Site vendosen vetem `VITE_SUPABASE_URL` dhe
`VITE_SUPABASE_ANON_KEY`.

## Overview
SmartManage tani ka **Real AI Integration** me:
- ✅ **Google Cloud Vision API** - OCR i avancuar për imazhe
- ✅ **OpenAI GPT** - NLP dhe text understanding
- ✅ **Hybrid Processing** - Kombinim regex + AI për speed + accuracy

---

## 1. Setup Google Vision API

### Step 1: Create Google Cloud Project
1. Shko në https://console.cloud.google.com/
2. Krijo projekt të ri: "SmartManage Vision"
3. Vendoso billing (20$ free tier çdo muaj)

### Step 2: Enable Vision API
1. **APIs & Services** → **Library**
2. Kërko **"Cloud Vision API"**
3. Click **Enable**

### Step 3: Create Service Account
1. **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **Service Account**
3. Fill form:
   - Service account name: `smartmanage-ocr`
   - Grant roles: `Cloud Vision API User`
4. Click **Done**

### Step 4: Generate API Key
1. Klik në service account
2. Tab **Keys** → **Add Key** → **JSON**
3. Shkarko JSON file
4. Extrakto `private_key` dhe `project_id`

### Step 5: Add to Supabase secrets
```bash
supabase secrets set GOOGLE_VISION_API_KEY="your-google-vision-api-key"
supabase functions deploy vision-ocr
```

### Usage
```typescript
import { extractTextFromImage } from './lib/googleVision.ts'

const imageBase64 = await fetch('/image.jpg').then(r => r.blob()).then(b => btoa(b))
const result = await extractTextFromImage(imageBase64)
// → { fullText: "...", textBlocks: [...], confidence: 85, ... }
```

---

## 2. Setup OpenAI API

### Step 1: Create OpenAI Account
1. Shko në https://platform.openai.com/signup
2. Sign up me email

### Step 2: Get API Key
1. **Account** (top-right) → **API keys**
2. Click **Create new secret key**
3. Copy key (shfaqet vetëm një herë!)

### Step 3: Add Billing
1. **Billing** → **Set up paid account**
2. Shto credit card
3. Set monthly budget (recommended: $5-20)

### Step 4: Add to Supabase secrets
```bash
OPENAI_API_KEY="sk-your-key-here"
OPENAI_MODEL="gpt-4o-mini"
```

### Usage
```typescript
import { analyzeShortageWithAI } from './lib/openaiClient.ts'

const text = "Nevojitet 50 aspirin urgjent per pacientin ne spital"
const result = await analyzeShortageWithAI(text)
// → { productName: "aspirin", quantity: 50, urgency: "HIGH", ... }
```

---

## 3. Use AI in Document Processing

### Option A: Regex Only (Fast, Offline)
```typescript
const result = interpretShortageNaturalLanguage(text)
// Processing method: REGEX
// Speed: ~1ms
// Accuracy: 70-80%
```

### Option B: AI Only (Slow, High Accuracy)
```typescript
const result = await interpretShortageWithAI(text)
// Processing method: OPENAI
// Speed: ~2-3s
// Accuracy: 90-95%
```

### Option C: Hybrid (Recommended)
```typescript
const result = await interpretShortageHybrid(text, preferAI = false)
// Uses REGEX for short texts, OpenAI for long texts
// Smart fallback if API fails
// Speed: ~50ms - 2s
// Accuracy: 85-95%
```

### Option D: Urgency Classification
```typescript
// Regex-based (fast)
const result1 = classifyUrgencyFromText(text)

// AI-based (accurate)
const result2 = await classifyUrgencyWithAI(text)
```

---

## 4. Integration Points

### In mungesat.ts (Worker Page)
```typescript
import { interpretShortageHybrid, classifyUrgencyWithAI } from './lib/documentAi.ts'

// When user submits shortage text
const interpretation = await interpretShortageHybrid(userInput)
const urgency = await classifyUrgencyWithAI(userInput)

// Show result with AI confidence
console.log(`AI Confidence: ${interpretation.confidence}`)
console.log(`Method Used: ${interpretation.method}`)
```

### In pronari.ts (Owner Dashboard)
```typescript
import { detectClinicalContextWithAI } from './lib/documentAi.ts'

// When analyzing shortage patterns
const clinical = await detectClinicalContextWithAI(notes)
if (clinical.isClinical) {
  // Increase priority for clinical shortages
  priority += 25
}
```

### In data.ts (Data Layer)
```typescript
import { analyzeShortageWithAI } from './lib/openaiClient.ts'

// When recording new shortage
const aiAnalysis = await analyzeShortageWithAI(shortageNote)
await recordShortage({
  ...shortage,
  aiConfidence: aiAnalysis.confidence,
  aiCategory: aiAnalysis.urgency
})
```

---

## 5. Costs & Limits

### Google Vision API
- **Free Tier**: 1,000 requests/month
- **After**: $1.50 per 1,000 requests
- **Limit**: 500 requests/minute

### OpenAI API
- **gpt-3.5-turbo**: $0.0005 per 1K tokens (input)
- **gpt-4**: $0.03 per 1K tokens (input)
- **Average shortage analysis**: ~50 tokens = $0.000025
- **Daily budget** (1000 analyses): ~$0.025

**Recommendation**: Use gpt-3.5-turbo, fallback to regex for high volume

---

## 6. Error Handling

```typescript
import { interpretShortageWithAI } from './lib/documentAi.ts'

try {
  const result = await interpretShortageWithAI(text)
  if (result.method === 'REGEX') {
    console.warn('AI unavailable, using regex fallback')
  }
  if (result.confidence < 50) {
    console.warn('Low confidence interpretation, manual review recommended')
  }
} catch (error) {
  console.error('Shortage interpretation failed:', error)
  // Fallback to manual entry
}
```

---

## 7. Monitoring & Logging

### Log AI Usage
```typescript
if (process.env.LOG_AI_USAGE) {
  console.log({
    timestamp: new Date(),
    method: interpretation.method,
    confidence: interpretation.confidence,
    tokensUsed: aiResponse?.tokensUsed,
    cost: aiResponse?.tokensUsed * 0.0005 / 1000
  })
}
```

### Track API Calls
- Monitor quota usage in Google Cloud Console
- Check OpenAI usage dashboard
- Set up billing alerts

---

## 8. Troubleshooting

| Problem | Solution |
|---------|----------|
| "API key not configured" | Add GOOGLE_VISION_API_KEY or OPENAI_API_KEY to Supabase secrets and deploy the functions |
| "Rate limit exceeded" | Wait 60s or use regex fallback |
| "Invalid JSON response" | Retry, AI sometimes generates invalid JSON |
| "Timeout (>30s)" | API is slow, fallback to regex |
| "High cost" | Use regex for high-volume, AI for important items |

---

## 9. Privacy & Security

⚠️ **Important**:
- **Never** commit .env.local to Git
- **Never** expose API keys in frontend code
- Google Vision may store images for 30 days
- OpenAI stores chat history for 30 days
- For HIPAA compliance, disable API logging

### Secure Setup
```bash
# Supabase secrets
supabase secrets set OPENAI_API_KEY=sk-xxxxx
supabase secrets set GOOGLE_VISION_API_KEY=xxxxx

# .gitignore
.env.local
*.key.json
```

---

## 10. Future Enhancements

- [ ] Cache AI responses (Redis) to reduce costs
- [ ] Batch API calls for better throughput
- [ ] Fine-tune models on pharmacy-specific data
- [ ] Add voice-to-text (Google Speech-to-Text)
- [ ] Real-time shortage predictions (ARIMA/Prophet)
- [ ] Seasonal demand forecasting with ML

---

**Questions?** Check OpenAI docs or Google Vision docs linked above.
