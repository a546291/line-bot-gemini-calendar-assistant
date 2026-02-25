# line-bot-gemini-calendar-assistant
使用 Google Gemini AI 解析文字與圖片，自動將活動加入 Google Calendar 的 LINE 機器人
# 📅 LINE AI 行事曆助理 (LINE AI Calendar Assistant)

這是一個基於 **Google Apps Script (GAS)** 的 LINE 機器人，整合了 **Google Gemini Pro/Flash (AI)** 模型。
它能「看懂」使用者傳送的文字訊息或活動海報圖片，自動擷取活動資訊並加入 **Google Calendar**，同時具備防呆機制與成本紀錄功能。

## ✨ 功能特色 (Features)

* **多模態理解 (Multimodal)**：
    * 支援 **純文字** 輸入（例如：「下週五晚上七點跟客戶吃飯」）。
    * 支援 **圖片/海報** 辨識（直接拍照上傳活動海報，AI 自動讀取時間地點）。
* **智慧邏輯判斷**：
    * 自動區分 **「活動時間」** 與 **「報名截止時間」** (避免將截止日誤判為活動日)。
    * 自動修正不合理的時間（如結束時間早於開始時間）。
    * 支援 **多行程解析** (一張課表圖片可一次建立多筆行程)。
* **衝突偵測**：
    * 建立行程前自動檢查行事曆，若該時段已有行程，會發出警告並列出衝突項目。
* **自動化提醒**：
    * 建立的行程預設加入「活動前 30 分鐘」推播通知。
* **成本與紀錄追蹤**：
    * 自動將所有請求紀錄至 **Google Sheet**。
    * 計算並記錄每次呼叫 Gemini API 的 Token 用量與預估美金費用。

## 🛠️ 安裝教學 (Installation)

### 步驟 1：準備 API Key
1.  **LINE Messaging API Channel Access Token**: 
    * 前往 [LINE Developers Console](https://developers.line.biz/) 建立一個 Messaging API Channel。
    * 取得長效型的 Access Token。
2.  **Google Gemini API Key**:
    * 前往 [Google AI Studio](https://aistudio.google.com/) 取得 API Key。

### 步驟 2：建立 Google Sheet
1.  建立一個新的 Google Sheet。
2.  記下網址中的 ID (例如 `d/abc123456.../edit` 中間那串亂碼)。
3.  (可選) 首次執行程式時，可執行 `setupSheet()` 函式自動產生標題列。

### 步驟 3：部署 Google Apps Script
1.  建立一個新的 [Google Apps Script](https://script.google.com/) 專案。
2.  將本專案中的 `Code.gs` 內容完整複製並貼上。
3.  **修改程式碼最上方的設定區**，填入你的資訊：
    ```javascript
    const LINE_ACCESS_TOKEN = '你的_LINE_CHANNEL_ACCESS_TOKEN';
    const GEMINI_API_KEY = '你的_GEMINI_API_KEY';
    const SPREADSHEET_ID = '你的_GOOGLE_SHEET_ID';
    ```
4.  點擊右上角 **「部署 (Deploy)」** -> **「新增部署作業 (New deployment)」**。
5.  選擇類型：**「網頁應用程式 (Web app)」**。
6.  設定如下：
    * **執行身分 (Execute as)**: `Me` (我)。
    * **誰可以存取 (Who has access)**: `Anyone` (任何人) ※這是為了讓 LINE 平台能呼叫 webhook。
7.  點擊部署，並複製產生的 **Web App URL**。

### 步驟 4：設定 LINE Webhook
1.  回到 [LINE Developers Console](https://developers.line.biz/)。
2.  將剛剛複製的 Web App URL 貼入 **Webhook URL** 欄位。
3.  開啟 **Use Webhook**。
4.  關閉 **Auto-reply messages (自動回覆)** 功能。

## 🚀 使用方法 (Usage)

1.  **加機器人好友**：掃描你的 LINE Bot QR Code。
2.  **傳送文字**：
    > "明天早上 10 點到 12 點在學校會議室開校務會議"
3.  **傳送圖片**：
    > 直接上傳一張活動海報、研習公文或課表截圖。
4.  **查看結果**：
    * 機器人會回覆行程建立結果。
    * 若有衝突會一併提示。
    * Google Calendar 會自動出現該行程。

## 📋 系統需求
* Google 帳號 (用於 GAS 與 Gemini)。
* LINE 帳號。

## 📄 License
MIT License

# 📅 LINE AI Calendar Assistant

This is a smart LINE Bot built with **Google Apps Script (GAS)** and powered by **Google Gemini Pro/Flash (AI)**.
It understands both **text messages** and **images** (e.g., event posters, schedules), automatically extracting event details to create **Google Calendar** events. It also features conflict detection, cost tracking, and smart logic to distinguish between event dates and registration deadlines.

## ✨ Features

* **Multimodal Understanding**:
    * **Text Parsing**: Understands natural language (e.g., "Dinner with client next Friday at 7 PM").
    * **Image Recognition**: Upload photos of event posters, meeting agendas, or screenshots. The AI extracts dates, times, and locations automatically.
* **Smart Logic & Error Prevention**:
    * **Event vs. Deadline**: Intelligently distinguishes between the actual "Event Time" and "Registration Deadlines" (deadlines are noted in the description, not set as the event date).
    * **Auto-Correction**: Automatically fixes logical errors, such as an end time being earlier than the start time.
    * **Batch Processing**: Capable of detecting and creating multiple events from a single image or text message.
* **Conflict Detection**:
    * Checks your existing Google Calendar before creating an event. If there is a time overlap, it warns you and lists the conflicting events.
* **Automated Reminders**:
    * All created events include a default **30-minute popup reminder**.
* **Cost & Usage Logging**:
    * Logs all requests to a **Google Sheet**.
    * Tracks Token usage (Input/Output) and estimates the cost based on Gemini API pricing.

## 🛠️ Installation & Setup

### Step 1: Prepare API Keys
1.  **LINE Messaging API Channel Access Token**:
    * Go to the [LINE Developers Console](https://developers.line.biz/).
    * Create a "Messaging API" channel.
    * Issue a long-lived Channel Access Token.
2.  **Google Gemini API Key**:
    * Go to [Google AI Studio](https://aistudio.google.com/).
    * Get your API Key.

### Step 2: Set up Google Sheet
1.  Create a new Google Sheet.
2.  Copy the **Spreadsheet ID** from the URL (the string between `d/` and `/edit`).
    * Example: `https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit`
3.  *(Optional)* Run the `setupSheet()` function in your script once to initialize the header row.

### Step 3: Deploy Google Apps Script
1.  Create a new project at [Google Apps Script](https://script.google.com/).
2.  Copy the code from `Code.gs` in this repository and paste it into your project.
3.  **Configure the variables** at the top of the script:
    ```javascript
    const LINE_ACCESS_TOKEN = 'YOUR_LINE_CHANNEL_ACCESS_TOKEN';
    const GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY';
    const SPREADSHEET_ID = 'YOUR_GOOGLE_SHEET_ID';
    ```
4.  Click **Deploy** -> **New deployment**.
5.  Select type: **Web app**.
6.  Configuration:
    * **Description**: Initial deploy.
    * **Execute as**: `Me` (Important: so it can access your Calendar).
    * **Who has access**: `Anyone` (Important: so LINE can send webhooks to it).
7.  Click **Deploy** and copy the **Web App URL**.

### Step 4: Configure LINE Webhook
1.  Go back to the [LINE Developers Console](https://developers.line.biz/).
2.  Paste your **Web App URL** into the **Webhook URL** field.
3.  Enable **Use Webhook**.
4.  Disable **Auto-reply messages** in the LINE Official Account settings to prevent default auto-responses.

## 🚀 Usage

1.  **Add the Bot**: Scan the QR code of your LINE Official Account.
2.  **Send Text**:
    > "Team meeting tomorrow from 10 AM to 12 PM at Conference Room A."
3.  **Send Image**:
    > Upload a picture of a seminar poster or a class schedule.
4.  **Check Results**:
    * The bot will reply with the created event details.
    * It will alert you if there are any schedule conflicts.
    * The event will appear in your Google Calendar instantly.
    * Usage logs and costs will be recorded in your Google Sheet.

## 📋 Requirements
* A Google Account (for GAS, Gemini API, and Sheets).
* A LINE Account (to create the bot).

## 📄 License
This project is licensed under the terms of the MIT License.
