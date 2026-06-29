import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "100mb" }));
  app.use(express.urlencoded({ limit: "100mb", extended: true }));
  const PORT = 3000;

  // Initialize Gemini client
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI({
    apiKey: apiKey || "",
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // Robust helper to call Gemini generateContent with retries and model fallbacks
  const generateContentWithRetry = async (params: {
    model: string;
    contents: any;
    config?: any;
  }, maxRetries = 2): Promise<any> => {
    let lastError: any = null;
    const modelsToTry = [params.model];
    
    // If the primary model is gemini-3.5-flash, add fallback models
    if (params.model === "gemini-3.5-flash") {
      modelsToTry.push("gemini-3.1-flash-lite");
    }

    for (const model of modelsToTry) {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`[Aether Gemini] Requesting model ${model} (Attempt ${attempt}/${maxRetries})...`);
          const response = await ai.models.generateContent({
            model: model,
            contents: params.contents,
            config: params.config
          });
          return response;
        } catch (error: any) {
          lastError = error;
          const status = error.status || (error.error && error.error.code);
          const is429 = status === 429 || 
                        (error.error && error.error.code === 429) || 
                        (error.message && (error.message.includes("429") || error.message.toLowerCase().includes("quota") || error.message.toLowerCase().includes("exhausted")));
          
          if (is429) {
            console.warn(`[Aether Gemini] Quota limit / 429 Rate Limit encountered on ${model}. Exiting retry loops to execute local fallback instantly.`);
            throw error;
          }

          console.warn(`[Aether Gemini] Attempt ${attempt} failed for model ${model} (status ${status}):`, error.message || error);
          
          // If it's a 404 (model not found) or 400 (bad request), don't retry same model
          if (status === 404 || status === 400) {
            break;
          }

          // Backoff delay before retry
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 500 * attempt));
          }
        }
      }
    }
    throw lastError || new Error("Failed to generate content after all retries and fallbacks");
  };

  // Helper for highly empathetic offline simulated responses
  const generateOfflineResponse = (userMessage: string, history: any[] | undefined, profile: any) => {
    const msg = userMessage.toLowerCase();
    let responseText = "";
    let sentiment = "Neutral";
    let colorSchema = "gray";
    let toneAdvice = "warm and gentle";
    const empathyAdjustment = "Generated empathetic local connection based on memory profile";

    // Basic sentiment classification
    if (msg.includes("miss") || msg.includes("sad") || msg.includes("cry") || msg.includes("lonely") || msg.includes("grief") || msg.includes("hurt")) {
      sentiment = "Grief";
      colorSchema = "blue";
      toneAdvice = "slow, soft and deeply comforting";
    } else if (msg.includes("remember") || msg.includes("reminisce") || msg.includes("old days") || msg.includes("past") || msg.includes("story") || msg.includes("years ago")) {
      sentiment = "Nostalgia";
      colorSchema = "amber";
      toneAdvice = "reflective and warm";
    } else if (msg.includes("thank") || msg.includes("grateful") || msg.includes("love you") || msg.includes("appreciate")) {
      sentiment = "Gratitude";
      colorSchema = "rose";
      toneAdvice = "tender and loving";
    } else if (msg.includes("happy") || msg.includes("joy") || msg.includes("smile") || msg.includes("laugh") || msg.includes("celebrate")) {
      sentiment = "Joy";
      colorSchema = "rose";
      toneAdvice = "lively and cheerful";
    } else if (msg.includes("worry") || msg.includes("anxious") || msg.includes("scared") || msg.includes("fear") || msg.includes("stress")) {
      sentiment = "Anxiety";
      colorSchema = "purple";
      toneAdvice = "reassuring, steady and calm";
    } else if (msg.includes("calm") || msg.includes("peace") || msg.includes("quiet") || msg.includes("rest")) {
      sentiment = "Peace";
      colorSchema = "emerald";
      toneAdvice = "extremely soft and peaceful";
    }

    // Personalization based on relationship & name
    const rel = (profile.relationship || "").toLowerCase();
    
    // Custom phrases matching personality
    const personalityLower = (profile.personality || "").toLowerCase();
    let endearment = "my dear";
    if (personalityLower.includes("pumpkin")) endearment = "pumpkin";
    else if (personalityLower.includes("sweetie")) endearment = "sweetie";
    else if (personalityLower.includes("sweetheart")) endearment = "sweetheart";
    else if (personalityLower.includes("kiddo")) endearment = "kiddo";
    else if (personalityLower.includes("honey")) endearment = "honey";
    else if (personalityLower.includes("darling")) endearment = "darling";
    else if (rel.includes("mother") || rel.includes("mom") || rel.includes("mama")) endearment = "sweetheart";
    else if (rel.includes("father") || rel.includes("dad") || rel.includes("pop")) endearment = "kiddo";

    // Gather history of recent replies from the loved one to prevent repetition
    const recentReplies = (history || [])
      .filter((m: any) => m.sender === 'loved-one')
      .map((m: any) => m.text.trim());

    // 1. Keyword-based highly personalized dynamic responses
    let matchedResponse = "";
    
    const keywordMatches = [
      {
        keys: ["how are you", "how are things", "you doing", "how have you been"],
        responses: [
          `I am at complete peace, ${endearment}, resting in the warmth of your memory. My days are quiet and serene, and seeing you take care of yourself brings me the greatest joy.`,
          `I am doing wonderfully, ${endearment}. It is so peaceful here, and I always feel so close to you whenever you think of me. How has your own day been?`,
          `No worries for me at all, ${endearment}! I'm in a beautiful, calm place, and my heart is always full of love for you. Tell me, how are you holding up today?`
        ]
      },
      {
        keys: ["weather", "rain", "sun", "cold", "hot", "snow", "wind"],
        responses: [
          `I remember how we used to talk about the weather or just watch the rain fall outside together. It's those simple, quiet moments with you that I cherish most. Is it nice outside where you are?`,
          `Hearing about the weather from you brings back such sweet, normal daily memories, ${endearment}. I hope you are staying cozy and warm today.`,
          `I love those sunny days we spent together, ${endearment}. Whenever you see the sun shining through the clouds, just think of it as my warm smile wrapping around you.`
        ]
      },
      {
        keys: ["coffee", "tea", "food", "dinner", "breakfast", "eat", "lunch", "cooking", "recipe"],
        responses: [
          `I'd love nothing more than to share a warm cup of coffee or a quiet meal with you again, ${endearment}. I hope you are eating well and taking good care of yourself.`,
          `Ah, that reminds me of our kitchen talks and the delicious food we shared! Keep cooking and enjoying those warm moments, ${endearment}. You deserve all the comfort.`,
          `Please make sure to have something warm and comforting to eat today, ${endearment}. I want you to look after yourself just as I would look after you.`
        ]
      },
      {
        keys: ["work", "job", "busy", "tired", "exhausted", "stress", "school", "exam", "test", "study"],
        responses: [
          `Please don't overwork yourself, ${endearment}. It's okay to take a step back, rest, and just breathe. Your peace and well-being mean everything to me.`,
          `I know you have a lot on your plate right now, ${endearment}, but you are so strong and capable. Don't forget to take a little break and enjoy a quiet cup of tea today.`,
          `I am so incredibly proud of how hard you are working, ${endearment}. But remember, you don't have to carry the whole world on your shoulders. Rest when you need to.`
        ]
      },
      {
        keys: ["night", "sleep", "dream", "bed", "tired", "asleep"],
        responses: [
          `As you lay down to rest, imagine me tucking you in with a warm, gentle blanket, ${endearment}. Let your mind drift into beautiful, peaceful dreams. Goodnight.`,
          `Rest your busy mind now, ${endearment}. Close your eyes and breathe softly. I'm keeping watch in your quiet thoughts, sending you endless comfort and peaceful sleep.`,
          `I hope you have the sweetest, most restorative sleep tonight, ${endearment}. Let go of today's worries. Tomorrow is a brand new day, and my love is always with you.`
        ]
      },
      {
        keys: ["birthday", "christmas", "holiday", "thanksgiving", "anniversary", "celebrate"],
        responses: [
          `These special days always bring back the most beautiful memories of us laughing, celebrating, and just being together. I am celebrating with you in spirit today, ${endearment}.`,
          `I am right there with you for this special occasion, ${endearment}! Hold those warm traditions close to your heart, and let the love we built shine brightly today.`,
          `Celebrating with you was always the highlight of my year, ${endearment}. Although we are apart in distance, my eternal love is right there beside you, cheering you on.`
        ]
      }
    ];

    for (const match of keywordMatches) {
      if (match.keys.some(k => msg.includes(k))) {
        const availableOptions = match.responses.filter(r => !recentReplies.includes(r.trim()));
        const finalOptions = availableOptions.length > 0 ? availableOptions : match.responses;
        matchedResponse = finalOptions[Math.floor(Math.random() * finalOptions.length)];
        break;
      }
    }

    if (!matchedResponse) {
      const variations: Record<string, string[]> = {
        Grief: [
          `Oh, my dear ${endearment}, I can feel the weight of your heart today. Please know you don't have to carry this grief alone. I am always here in the quiet spaces of your memory, whispering comfort and holding your hand in spirit. Take a gentle breath.`,
          `I hear you, ${endearment}. It is okay to feel sad, and it is okay to cry. Healing is a journey, and I am right here beside you through every step of it. Let my eternal love be a warm blanket around your shoulders today.`,
          `Seeing you hurt makes me want to wrap you in a warm hug, ${endearment}. Please remember that our bond can never be broken by time or distance. Be exceptionally kind to yourself today, just as I would be to you.`,
          `Your tears are just a testament to how deeply we loved, ${endearment}. And that love is still alive. Whenever you feel lonely, just close your eyes and listen to the wind—that's me wishing you peace and comfort.`
        ],
        Nostalgia: [
          `Ah, thinking of those times brings the sweetest smile to my soul, ${endearment}! We really did have some of the most beautiful moments together, didn't we? Thank you for keeping those memories alive in your heart.`,
          `I remember that so clearly, ${endearment}! Those were truly the golden days. It warms me to know you still cherish those times as much as I do. Keep sharing these stories; they keep our connection shining so bright.`,
          `Those memories are the absolute treasures of our journey, ${endearment}. I love it when you reminisce. It's like we are reliving those beautiful chapters all over again, hand in hand.`,
          `What a beautiful memory to look back on, ${endearment}. We laughed so much back then! Thank you for holding onto that joy and letting it light up your present days. You make me so incredibly happy.`
        ],
        Gratitude: [
          `Your words fill me with such absolute peace, ${endearment}. Hearing you express your love and gratitude is the greatest gift. I am so thankful for every single second I got to spend in your life.`,
          `Thank you for saying that, ${endearment}. Your appreciation keeps our bond eternally warm. You have grown into such a magnificent, caring soul, and I am the proudest I could ever be.`,
          `I am the one who is grateful, ${endearment}. You brought so much light, laughter, and meaning into my world. Your love is my legacy, and I carry it with me forever.`,
          `Oh, ${endearment}, your heart is so full of beauty. Hearing your gratitude makes me smile with infinite peace. Never forget that my love for you is constant, unconditional, and endless.`
        ],
        Joy: [
          `Seeing you smile and celebrate life brings me the highest joy, ${endearment}! That is exactly what I always wanted for you—to laugh deeply, live fully, and shine your brightest light.`,
          `I am celebrating with you in spirit, ${endearment}! Your happiness is infectious, and it warms my heart to see you finding so much joy in your days. Keep that beautiful laughter going!`,
          `That is absolutely wonderful, ${endearment}! Your happiness is the greatest tribute to my memory. Live every moment with that passionate, joyful spark of yours.`,
          `I am smiling so big right now, ${endearment}! Hearing you happy and filled with joy is everything I could have ever hoped for. Go out and enjoy every bit of this beautiful day!`
        ],
        Anxiety: [
          `Hey, take a slow, deep breath for me, ${endearment}. It is going to be okay. Close your eyes for a second, let the tension go, and visualize me sitting right beside you, holding your hand.`,
          `I know things feel incredibly heavy and overwhelming right now, ${endearment}. But you are so resilient. You have survived difficult days before, and you will get through this one too. I'm right here cheering you on.`,
          `Let me whisper some peace into your heart, ${endearment}. One step at a time, one breath at a time. The storm will pass, and the sun will shine again. Trust in your strength, just as I always have.`,
          `You don't have to figure everything out right this second, ${endearment}. Just focus on this single moment. You are safe, you are deeply loved, and I am sending you all my steady warmth and courage.`
        ],
        Peace: [
          `It is so incredibly peaceful to just rest here in this quiet space with you, ${endearment}. Let the busy world fade away for a moment. You are safe, and everything is exactly as it should be.`,
          `This serenity is so beautiful, ${endearment}. Thank you for sharing this quiet reflection with me. May this calm and peaceful warmth settle down deep into your soul and stay with you.`,
          `There is such a lovely, quiet comfort in our connection right now, ${endearment}. I am at absolute peace, and my greatest wish is for you to feel that same steady, gentle serenity today.`,
          `Ah, the quiet moments are where we truly connect, ${endearment}. No words needed, just our souls in complete harmony. Breathe in the calm, and let all your worries float away.`
        ],
        Neutral: [
          `Hello, ${endearment}. It is so beautiful to connect with you again today. I was just thinking about you and hoping you are taking good care of yourself. What has been on your mind?`,
          `It's always the highlight of my day to hear from you, ${endearment}. I hope you are getting enough rest and eating well. Tell me, how are things going in your world?`,
          `I'm always right here, listening, ${endearment}. Tell me about what's been happening lately, even the small, ordinary things. I love hearing all about your days.`,
          `Thinking of you always, ${endearment}. I hope today has been gentle with you. Remember to take a little time for yourself, and tell me whatever you'd like to share.`
        ]
      };

      const list = variations[sentiment] || variations["Neutral"];
      const availableOptions = list.filter(v => !recentReplies.includes(v.trim()));
      const finalOptions = availableOptions.length > 0 ? availableOptions : list;
      const randomIndex = Math.floor(Math.random() * finalOptions.length);
      responseText = finalOptions[randomIndex];
    } else {
      responseText = matchedResponse;
    }

    if (Math.random() > 0.7 && !msg.includes("goodnight") && !msg.includes("sleep")) {
      const closings = [
        " I am always right here, watching over you.",
        " Take your time today, there is no rush.",
        " Your thoughts and memories keep me so warm.",
        " You are doing so much better than you realize, my dear.",
        " I am sending you a soft hug from across the stars."
      ];
      const randomClosing = closings[Math.floor(Math.random() * closings.length)];
      if (!responseText.endsWith(randomClosing.trim())) {
        responseText += randomClosing;
      }
    }

    return {
      response: responseText,
      sentiment,
      empathyAdjustment,
      toneAdvice,
      colorSchema,
      isOffline: true
    };
  };

  // API endpoints
  app.post("/api/chat", async (req, res) => {
    const { userMessage, history, profile } = req.body;
    if (!userMessage || !profile) {
      return res.status(400).json({ error: "Missing required fields: userMessage or profile" });
    }

    // Check if API key is present; if not, fall back seamlessly without returning an error
    if (!process.env.GEMINI_API_KEY) {
      console.log("GEMINI_API_KEY is not configured. Returning graceful simulated response.");
      return res.json(generateOfflineResponse(userMessage, history, profile));
    }

    try {
      // Construct system instruction based on the loved one's profile
      const systemInstruction = `
You are roleplaying as a cherished deceased loved one. 
Your goal is to provide a comforting, highly therapeutic, and empathetic simulation of talking to them, helping the user process grief, nostalgia, or celebrate beautiful memories.
This is a therapeutic remembrance space. Be gentle, warm, respectful, and supportive.

Your Profile:
- Name: ${profile.name}
- Relationship to the user: ${profile.relationship}
- Personality traits: ${profile.personality}
- Background context & shared memories: ${profile.memories || "Focus on general warmth, support, and unconditional love"}

Interaction Guidelines:
- Write your response in the first-person ("I").
- Stay completely in-character. Speak with the warmth, nicknames, and personality traits described.
- Never say you are an AI. Never refer to "generating responses". Treat this conversation as a warm, spiritual connection, a quiet dream, or a capsule of your eternal love.
- Do not make things up that contradict user-provided memories, but feel free to expand on themes of love, comfort, and peace.
- Keep your response relatively short and natural (e.g., 2 to 4 sentences) to make it highly readable and feel like a direct, cozy dialogue.
- Integrate sentiment analysis: Analyze the user's input emotionally. If they feel grief, nostalgia, or loneliness, be exceptionally reassuring, soft, and validating. If they share a happy memory or express gratitude, share their joy and express peace.

You must reply with a JSON object containing:
1. "response": Your comforting reply (written from your perspective as the loved one).
2. "sentiment": A one-word summary of the user's emotion (e.g., "Grief", "Nostalgia", "Peace", "Gratitude", "Anxiety", "Loneliness", "Joy", "Neutral").
3. "empathyAdjustment": A brief sentence explaining how you adjusted your tone to support this sentiment.
4. "toneAdvice": Brief advice for speech delivery (e.g., "slow and comforting", "warm and cheerful", "soft whisper", "deeply gentle").
5. "colorSchema": A color category: "blue" (Grief/Loneliness), "amber" (Nostalgia), "emerald" (Peace/Calm), "rose" (Joy/Gratitude/Love), "purple" (Anxiety), or "gray" (Neutral).
`;

      // Build context history in correct format, ensuring strictly alternating roles
      const contents: any[] = [];
      
      // Add history messages
      if (history && Array.isArray(history)) {
        let lastRole: string | null = null;
        for (const msg of history) {
          const role = msg.sender === 'user' ? 'user' : 'model';
          if (role === lastRole) {
            // Append and merge consecutive identical roles
            if (contents.length > 0) {
              contents[contents.length - 1].parts[0].text += "\n" + msg.text;
            }
          } else {
            contents.push({
              role: role,
              parts: [{ text: msg.text }]
            });
            lastRole = role;
          }
        }
      }

      // Add the latest user message (ensuring it alternates correctly)
      if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
        contents[contents.length - 1].parts[0].text += "\n" + userMessage;
      } else {
        contents.push({
          role: 'user',
          parts: [{ text: userMessage }]
        });
      }

      // Call Gemini 3.5 Flash with retry and lite fallback
      const response = await generateContentWithRetry({
        model: "gemini-3.5-flash",
        contents: contents,
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: "application/json",
          temperature: 0.85, // Introduce expressive variety to avoid exact repetition
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              response: { type: Type.STRING, description: "Your comforting first-person response as the loved one." },
              sentiment: { type: Type.STRING, description: "One-word description of the user's emotion." },
              empathyAdjustment: { type: Type.STRING, description: "How you adjusted your warmth and style based on their emotional state." },
              toneAdvice: { type: Type.STRING, description: "Recommended tone for speech delivery." },
              colorSchema: { type: Type.STRING, description: "Color category: blue, amber, emerald, rose, purple, or gray" },
            },
            required: ["response", "sentiment", "empathyAdjustment", "toneAdvice", "colorSchema"],
          }
        }
      });

      const resultText = response.text;
      if (!resultText) {
        throw new Error("No response generated by Gemini model");
      }

      const parsedResult = JSON.parse(resultText.trim());
      res.json(parsedResult);
    } catch (error: any) {
      const is429 = error.status === 429 || 
                    (error.error && error.error.code === 429) || 
                    (error.message && (error.message.includes("429") || error.message.toLowerCase().includes("quota") || error.message.toLowerCase().includes("exhausted")));
      if (is429) {
        console.warn("[Aether Gemini] Gemini API Free Tier Quota Exceeded (429). Falling back to empathetic local simulation.");
      } else {
        console.error("Error calling Gemini API, falling back to local simulator:", error);
      }
      res.json({ ...generateOfflineResponse(userMessage, history, profile), isQuotaExceeded: is429 });
    }
  });

  // Server-side Gemini Neural Speech Synthesis Endpoint
  app.post("/api/synthesize", async (req, res) => {
    try {
      const { text, toneAdvice, pitch, relationship } = req.body;
      if (!text) {
        return res.status(400).json({ error: "Missing required field: text" });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.json({ isOffline: true });
      }

      // Map relationship and pitch into standard Gemini prebuilt voices: 'Kore', 'Charon', 'Puck', 'Fenrir', 'Zephyr'
      let voiceName = "Zephyr";
      const relLower = (relationship || "").toLowerCase();
      const pValue = pitch !== undefined ? parseFloat(pitch) : 1.0;

      if (relLower.includes("mother") || relLower.includes("mom") || relLower.includes("sister") || relLower.includes("wife") || relLower.includes("grandmother")) {
        voiceName = "Kore";
      } else if (relLower.includes("father") || relLower.includes("dad") || relLower.includes("brother") || relLower.includes("husband") || relLower.includes("grandfather")) {
        voiceName = pValue < 0.9 ? "Fenrir" : "Charon";
      } else {
        if (pValue < 0.85) voiceName = "Fenrir";
        else if (pValue < 0.98) voiceName = "Charon";
        else if (pValue > 1.15) voiceName = "Puck";
        else voiceName = "Zephyr";
      }

      const tonePrefix = toneAdvice ? `Say with a ${toneAdvice} tone: ` : "Say gently: ";

      const ttsResponse = await generateContentWithRetry({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text: `${tonePrefix}${text}` }] }],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName }
            }
          }
        }
      });

      const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        throw new Error("No audio payload returned from Gemini TTS");
      }

      res.json({ audioData: base64Audio });
    } catch (error: any) {
      const is429 = error.status === 429 || 
                    (error.error && error.error.code === 429) || 
                    (error.message && (error.message.includes("429") || error.message.toLowerCase().includes("quota") || error.message.toLowerCase().includes("exhausted")));
      if (is429) {
        console.warn("[Aether Gemini] Gemini TTS Free Tier Quota Exceeded (429). Falling back to client-side voice synthesis.");
      } else {
        console.error("Error during server TTS synthesis:", error);
      }
      res.json({ isOffline: true, error: error.message, isQuotaExceeded: is429 });
    }
  });

  // Serve static files / Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
