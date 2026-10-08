# F 區 Mac mini 離線安裝與實測

版本：2026-10-07 r2（M2 雙螢幕＋iPad Wi-Fi）。適用 Apple Silicon（M 系列）Mac mini；以 macOS 15.6.1 / arm64 建置。Intel Mac 不適用本包。

## 安裝與兩個快捷啟動檔

1. 解壓縮整包到固定位置，不要只取出兩個快捷啟動檔。內含 Node 24.15.0、NFC 原生模組、三端程式與全部圖像／語音，不需 npm install 或網際網路。
2. 使用主機已安裝的 Google Chrome（預設路徑 /Applications/Google Chrome.app）。本包不含 Chrome 與額外廠商驅動；若換到未安裝 Chrome 的 Mac，須事先準備離線安裝檔。可在 offline/settings.json 指定 Chrome 執行檔路徑。
3. 雙擊 **Start-F.command**：開啟服務與 Table、Wall 兩個專用視窗。預設 live 實體感應模式，不顯示模擬卡片；尚未接 reader 時會等待設備。
4. 雙擊 **Stop-F.command**：關閉這組兩個專用視窗與服務，保留視窗設定檔及校正資料。日常瀏覽器不受影響。iPad Safari 不會由主機關閉。
5. 可在 Finder 對兩個檔案「製作替身」，將替身放到桌面。請勿把原始 .command 移離安裝包。macOS 若阻擋下載來源，依系統提示在「隱私權與安全性」允許此已確認來源的程式。
6. 重複 Start 不會再開一組已由啟動器管理的程序。改 mode 或位置前先 Stop。記錄在 .runtime/exhibition.log；不要刪除 .runtime/browser-*，其中包含投影校正。

## Wall／Table 雙螢幕與 iPad Wi-Fi

本版配置為一般 M2 Mac mini（8GB）：只輸出 Wall、Table 兩個獨立畫面；Graph 由第二台 iPad 透過 Wi-Fi 顯示，再外接 HDMI 螢幕。先在 macOS 顯示器設定選「延伸顯示」，不要鏡像。第一次將兩個視窗拖到對應螢幕，再從 Chrome 選單進入全螢幕。offline/settings.json 可設定各視窗位置與尺寸，需依現場螢幕解析度及排列校正。

iPad 使用 Safari 開啟 http://主機區網IP:6275/ipad。Start 會列出主機可用的 IPv4 連線網址；選擇與 iPad 同區網的位址。Mac 可以使用有線網路，iPad 使用同一路由器 Wi-Fi，不需外部網際網路。避免訪客 Wi-Fi／用戶端隔離，並允許 macOS 防火牆讓包內 Node 接受區網連線。主機 IP 建議在路由器保留，避免重啟後變動。

不使用 Sidecar、不在 Mac 上開 iPad 或 Graph 視窗。Stop 只關閉本機兩個專用視窗與服務，iPad Safari 留在原畫面；重新 Start 後確認 iPad 恢復連線。語音由 Table 共用出口播放。

本安裝包以 F_REQUIRED_DISPLAYS=table,wall,graph 啟動服務。Table／Wall／Graph 都須回報目前 revision 才能 ready；Graph 未連線、重複 role 或舊 revision 都不能通過。操作 iPad 仍有獨立連線／revision 回報。

第二台 iPad 開啟 http://主機IP:6275/graph?ws=ws://主機IP:6273（兩處主機IP都要替換）。保持 Safari 前景並外接螢幕；確認 NFC／重置同步。Graph 不在 Mac 本機自動開視窗。

若搭配 X 總控，須採用本版 server/x-f-adapter.mjs（支援 f-status.required；未提供時仍以原三屏為準）。本次未修改或部署現場 X；本版恢復三屏確認要求，仍需以現場採用的 X adapter 做整合驗收。

## 九台 ACR122U／USB PC/SC

- 九台都接在 Mac／USB hub；現場確認 hub 供電充足。PC/SC 在 macOS 提供系統介面，本包含可載入的 nfc-pcsc 原生模組。驅動、供電、九台同時穩定性須實機驗證。
- Start 後在主機瀏覽器開 http://localhost:6275/diagnostics.html，查看連接數、槽位、名稱、UID、已辨識家電與錯誤。
- 首次尚無 server/reader-map.json，依偵測順序暫編 1–9。依序插入九台並貼上槽位標籤，各感應一張卡確認實際位置。全部連接後按「匯出目前 9 台 reader-map.json」，把下載的檔案放進 server 資料夾，再 Stop → Start。
- 重新插 USB 埠或換 hub 後，作業系統 reader 名稱可能改變；必須再逐台驗證。未出現九個不同 reader 名稱時，診斷頁不會允許匯出完整對照。
- 卡片家電由 UID 判定，槽位只代表 reader 實體位置。九種家電 UID 已存在 server/uid-map.json；新卡若顯示「未登記」，從診斷頁記下 UID，更新 uid-map.json 並重啟。
- ACR122U 需要 PC/SC 卡片出現／離開事件；僅開啟三頁或看到連接數不能當作感應卡驗收。

## 實測順序

1. Start → 確认三個視窗、音訊與 WebSocket 連線。iPad 播放前導，只從 Table 發聲。
2. 逐台感應：診斷連接數達 9/9；每張卡放上／移除時，三頁都同步新增／移除正確家電。
3. 九張不同家電卡全部放上：三頁達 9/9；最後一段家電語音播完後，驗證全屋連動及完成頁。
4. 拔掉一台 reader：該槽位及卡片狀態清除。插回後重新放卡，三頁恢復同步。
5. 拿走所有卡片，iPad 重置：Table／iPad 回首頁、Wall 回待機，聲音停止。再開始下一輪。
6. Stop：兩個專用視窗關閉、6273–6275 服務停止。Start 後再次完成一輪。
7. 無外部網際網路時重做上述流程。iPad Safari 所需的區網連線仍須保留。

## 無硬體排練

Stop 後將 offline/settings.json 的 mode 改為 sim 再 Start。回到實測前改回 live 並重新啟動。模擬測試不代表 NFC 硬體驗收。

## 驗證範圍

2026-10-06 已通過程式與資源檢查，包含三端同步重置整合測試、九 reader 事件單元測試、素材／字幕／資料檢查。2026-10-01 曾用當時包內 Node 啟動實體模式，確認三個 Chrome 程序與 HTTP 入口、重複 Start 不增開、Stop 關閉四個程序並釋放三個埠。當時 reader 連接數為 0/9。電腦操作權限未開放，未做視窗像素檢查；iPad 外接畫面與九台 ACR122U 仍待接線實測。

本版更新內容見「版本紀錄-2026-10-06.md」。新版首次開啟 Table 會套用新預設配置；原瀏覽器設定會先備份至本機儲存空間，後續編輯仍可正常保留。新前言字幕時間依音檔停頓估算，尚待逐句試聽校對；本版轉場及投影配置仍須現場目視確認。

2026-10-07 驗證紀錄見 Mac-M2-20261007.txt。上方歷史實測不是本次現場硬體驗收。
