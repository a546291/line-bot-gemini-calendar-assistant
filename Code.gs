// --- 設定區 ---
const LINE_ACCESS_TOKEN = '請填入_YOUR_LINE_CHANNEL_ACCESS_TOKEN';
const GEMINI_API_KEY = '請填入_YOUR_GEMINI_API_KEY';
const SPREADSHEET_ID = '請填入_YOUR_GOOGLE_SHEET_ID';

// --- Gemini 1.5 Flash 定價 (每百萬 Token 美金) ---
// 註：Gemini 2.0 Flash 目前預覽期免費，此處使用 1.5 Flash 價格作為成本參考
const PRICE_PER_1M_INPUT = 0.075;
const PRICE_PER_1M_OUTPUT = 0.30;

// --- 初始化 Sheet 標題 (初次使用請手動執行一次此函式) ---
function setupSheet() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheets()[0];
  const headers = ["時間", "使用者輸入", "建立行程標題", "行程時間", "狀態", "Input Tokens", "Output Tokens", "預估費用(USD)"];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  Logger.log("Sheet 標題設定完成");
}

// --- 主程式：處理 LINE Webhook ---
// --- 主程式：處理 LINE Webhook ---
function doPost(e) {
  if (!e || !e.postData) return ContentService.createTextOutput("No post data");

  const msg = JSON.parse(e.postData.contents);
  const event = msg.events[0];
  const replyToken = event.replyToken;
  const msgType = event.message.type;
  const msgId = event.message.id;

  let geminiResult = null;
  let userContentLog = ""; 

  try {
    // 1. 接收資料並呼叫 AI
    if (msgType === 'text') {
      const userText = event.message.text;
      userContentLog = userText;
      geminiResult = callGeminiAPI(userText, null);
    } 
    else if (msgType === 'image') {
      const imageBlob = getLineContent(msgId);
      userContentLog = "[圖片訊息]";
      if (imageBlob) {
        geminiResult = callGeminiAPI(null, imageBlob);
      }
    } else {
      return ContentService.createTextOutput("OK");
    }

    // 2. 驗證 AI 回傳資料
    const extractedEvents = geminiResult ? geminiResult.events : [];
    const usage = geminiResult ? geminiResult.usage : { promptTokens: 0, candidatesTokens: 0 };
    
    // 計算成本
    const cost = calculateCost(usage.promptTokens, usage.candidatesTokens);
    const costStr = `$${cost.toFixed(6)}`;

    if (!extractedEvents || !Array.isArray(extractedEvents) || extractedEvents.length === 0) {
      const failMsg = (msgType === 'image') ? "這張圖片裡好像沒有明確的行程資訊，或是我看不懂。" : "抱歉，我沒抓到行程重點。";
      replyLine(replyToken, `${failMsg}\n(Token花費: In ${usage.promptTokens} / Out ${usage.candidatesTokens}, Cost: ${costStr})`);
      logToSheet(new Date(), userContentLog, "解析失敗", "-", "失敗", usage.promptTokens, usage.candidatesTokens, costStr);
      return ContentService.createTextOutput("OK");
    }

    // 3. 建立行程與衝突檢查
    const calendar = CalendarApp.getDefaultCalendar();
    let finalReplyMsg = "✅ 處理完成！\n";
    let successCount = 0;
    let logTitles = [];
    let logTimes = [];

    extractedEvents.forEach((eventData, index) => {
        if (!eventData.title) return;

        const startTime = new Date(eventData.startTime);
        // 使用 let 以便修正錯誤的時間
        let endTime = new Date(eventData.endTime); 

        // --- 🛡️【關鍵修正：防呆機制】開始 ---
        // 如果 結束時間 早於或等於 開始時間 (可能是 AI 抓錯日期或沒給結束時間)
        if (endTime <= startTime) {
           // 強制設定結束時間為：開始時間 + 1 小時
           endTime = new Date(startTime.getTime() + 60 * 60 * 1000); 
        }
        // --- 🛡️【關鍵修正：防呆機制】結束 ---

        let thisEventMsg = `\n📌 行程：${eventData.title}`;
        
        // 3.1 檢查衝突
        const existingEvents = calendar.getEvents(startTime, endTime);
        let conflictMsg = "";
        if (existingEvents.length > 0) {
          conflictMsg = "\n   ⚠️ 與現有行程重疊：";
          existingEvents.forEach(evt => {
            conflictMsg += `\n   - ${evt.getTitle()} (${formatTime(evt.getStartTime())})`;
          });
          thisEventMsg += conflictMsg;
        } else {
          thisEventMsg += `\n   (時間：${formatDate(startTime)})`;
        }
        
        if (eventData.location) {
          thisEventMsg += `\n   📍 地點：${eventData.location}`;
        }

        // 3.2 建立行程
        const options = {
          description: (eventData.description || "") + (conflictMsg ? "\n\n【衝突提醒】" + conflictMsg : ""),
          location: eventData.location || ""
        };
        
        const calEvent = calendar.createEvent(eventData.title, startTime, endTime, options);
        
        // 加入 30 分鐘提醒
        calEvent.addPopupReminder(30);
        thisEventMsg += `\n   🔔 提醒：已設定 30 分鐘前通知`;

        finalReplyMsg += thisEventMsg;
        successCount++;
        
        logTitles.push(eventData.title);
        logTimes.push(formatDate(startTime));
    });

    // 4. 加上 Token 與 費用 資訊
    finalReplyMsg += `\n------------------\n💰 耗用 Token: In ${usage.promptTokens} / Out ${usage.candidatesTokens}`;
    finalReplyMsg += `\n💵 預估費用: ${costStr}`;

    if (successCount === 0) {
       replyLine(replyToken, "有偵測到內容，但無法建立有效行程。");
       logToSheet(new Date(), userContentLog, "無有效行程", "-", "失敗", usage.promptTokens, usage.candidatesTokens, costStr);
    } else {
       replyLine(replyToken, finalReplyMsg);
       logToSheet(new Date(), userContentLog, logTitles.join(", "), logTimes.join(", "), "成功", usage.promptTokens, usage.candidatesTokens, costStr);
    }

  } catch (error) {
    Logger.log("Error: " + error.toString());
    replyLine(replyToken, `❌ 發生錯誤：${error.toString()}`);
    logToSheet(new Date(), userContentLog, "程式錯誤", error.toString(), "錯誤", 0, 0, 0);
  }

  return ContentService.createTextOutput("OK");
}

// --- 輔助函式：寫入 Google Sheet ---
function logToSheet(date, input, title, time, status, inTokens, outTokens, cost) {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheets()[0];
    sheet.appendRow([date, input, title, time, status, inTokens, outTokens, cost]);
  } catch (e) {
    Logger.log("寫入 Sheet 失敗: " + e.toString());
  }
}

// --- 輔助函式：計算費用 (Gemini 1.5 Flash) ---
function calculateCost(inputTokens, outputTokens) {
  // 價格單位是 Per Million (1,000,000)
  const inputCost = (inputTokens / 1000000) * PRICE_PER_1M_INPUT;
  const outputCost = (outputTokens / 1000000) * PRICE_PER_1M_OUTPUT;
  return inputCost + outputCost;
}

// --- 核心功能：呼叫 Gemini API (回傳 Event + Token Usage) ---
// --- 核心功能：呼叫 Gemini API (邏輯強化版) ---
function callGeminiAPI(text, imageBlob) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
  const now = new Date();
  const context = `現在時間是 ${now.toString()} (台灣時間)。`;

  // --- 更新後的 Prompt：教導 AI 區分「活動時間」與「截止時間」 ---
  const promptText = `
    ${context}
    請扮演專業秘書，分析輸入內容(文字或圖片)，提取行程資訊。
    **核心邏輯：請精準區分「活動舉辦時間」與「報名/截止時間」。**

    【提取規則】：
    1. title (標題): 活動名稱。
    2. startTime, endTime: 
       - 這是「活動真正發生」的時間。
       - ⚠️ 陷阱題注意：如果文中出現「報名截止於...」、「事前報名」、「早鳥優惠...」等日期，這些是【行政截止日】，**絕對不是**活動的開始或結束時間。
       - 範例：「3/28 掃墓，請於 3/20 前報名」 -> startTime 是 3/28，而 3/20 要寫在 description。
    3. location (地點): 優先辨識地圖截圖或文字地址。
    4. description (說明): 
       - 請將所有「報名截止日期」、「注意事項」、「攜帶物品」等資訊都整理在此。
       - 務必保留原始訊息中的重要連結或聯絡人。

    **【輸出格式要求】：**
    請回傳一個 JSON **陣列 (Array)**。
    
    JSON 陣列範例 (不要 Markdown):
    [
      {
        "title": "家族掃墓祭拜",
        "startTime": "2026-03-28T09:00:00+08:00",
        "endTime": "2026-03-28T11:00:00+08:00",
        "location": "牛稠埔",
        "description": "【重要】參加人數需在 3/20 前完成報名。\n集合地點：..."
      }
    ]
  `;

  let parts = [{ "text": promptText }];
  if (text) parts.push({ "text": `使用者文字: "${text}"` });
  if (imageBlob) {
    parts.push({
      "inline_data": {
        "mime_type": imageBlob.getContentType(),
        "data": Utilities.base64Encode(imageBlob.getBytes())
      }
    });
  }

  const payload = { "contents": [{ "parts": parts }] };
  const options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const json = JSON.parse(response.getContentText());
    
    // 取得 Token 用量
    const usage = json.usageMetadata || { promptTokenCount: 0, candidatesTokenCount: 0 };
    
    if (!json.candidates) {
      Logger.log("Gemini Response Error: " + JSON.stringify(json));
      return { events: [], usage: { promptTokens: usage.promptTokenCount, candidatesTokens: usage.candidatesTokenCount } };
    }

    const rawText = json.candidates[0].content.parts[0].text;
    const startIndex = rawText.indexOf('[');
    const endIndex = rawText.lastIndexOf(']') + 1;
    
    let events = [];
    if (startIndex !== -1 && endIndex !== -1) {
       events = JSON.parse(rawText.substring(startIndex, endIndex));
    }
    
    return {
      events: events,
      usage: {
        promptTokens: usage.promptTokenCount,
        candidatesTokens: usage.candidatesTokenCount || 0
      }
    };

  } catch (e) {
    Logger.log("Gemini API Error: " + e);
    return null;
  }
}

// --- 輔助函式 (無變更) ---
function getLineContent(messageId) {
  const url = `https://api-data.line.me/v2/bot/message/${messageId}/content`;
  try {
    const response = UrlFetchApp.fetch(url, {
      'headers': { 'Authorization': 'Bearer ' + LINE_ACCESS_TOKEN }
    });
    return response.getBlob();
  } catch (e) { Logger.log("Get LINE Content Error: " + e); return null; }
}

function replyLine(replyToken, text) {
  const url = 'https://api.line.me/v2/bot/message/reply';
  const payload = {
    'replyToken': replyToken,
    'messages': [{ 'type': 'text', 'text': text }]
  };
  UrlFetchApp.fetch(url, {
    'headers': { 'Content-Type': 'application/json; charset=UTF-8', 'Authorization': 'Bearer ' + LINE_ACCESS_TOKEN },
    'method': 'post', 'payload': JSON.stringify(payload)
  });
}

function formatDate(date) { return Utilities.formatDate(date, "GMT+8", "yyyy-MM-dd HH:mm"); }
function formatTime(date) { return Utilities.formatDate(date, "GMT+8", "HH:mm"); }