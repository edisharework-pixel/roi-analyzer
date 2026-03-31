/**
 * ROI Analyzer - Google Apps Script 백엔드
 *
 * 설치 방법:
 * 1. Google Sheets에서 새 스프레드시트 생성
 * 2. 확장 프로그램 → Apps Script
 * 3. 이 코드를 Code.gs에 붙여넣기
 * 4. initSheets() 함수를 한번 실행 (시트 헤더 자동 생성)
 * 5. 배포 → 새 배포 → 웹 앱 선택
 *    - 실행 사용자: 나
 *    - 액세스 권한: 모든 사용자
 * 6. 배포 URL을 ROI Analyzer 앱 설정에 입력
 */

const SHEETS = {
  PRODUCTS: '상품원가',
  SALES: '판매데이터',
  ADS: '광고비데이터',
  MARKETING: '마케팅비용'
};

const HEADERS = {
  상품원가: ['SKU', '상품명', '카테고리', '판매가', '원가', '물류비', '발주수량', '투자금액', '키워드', '제조사', '이미지URL', '등록일', '수정일'],
  판매데이터: ['날짜', 'SKU', '채널', '매출', '판매수량', '반품수량', '수수료', '수수료율', '리뷰수', '평점', '반품률', '등록일'],
  광고비데이터: ['날짜', 'SKU', '채널', '광고비', '노출수', '클릭수', '전환수', 'CPC', 'CTR', 'CVR', '등록일'],
  마케팅비용: ['ID', 'SKU', '유형', '항목명', '금액', '기대매출', '시작일', '종료일', '상태', '메모', '등록일']
};

const CHANNELS = ['쿠팡', '네이버', '네이버2', '지마켓', '11번가', '옥션', '자사몰', '기타'];

/**
 * 초기화 - 시트 및 헤더 자동 생성
 */
function initSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.entries(HEADERS).forEach(([name, headers]) => {
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
    }
    // 헤더가 비어있으면 설정
    const firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
    if (!firstRow[0]) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      sheet.getRange(1, 1, 1, headers.length).setBackground('#F1F5F9');
      sheet.setFrozenRows(1);
    }
  });
  // 채널 유효성 검사 추가
  const salesSheet = ss.getSheetByName(SHEETS.SALES);
  if (salesSheet) {
    const rule = SpreadsheetApp.newDataValidation().requireValueInList(CHANNELS).build();
    salesSheet.getRange('C2:C1000').setDataValidation(rule);
  }
  const adsSheet = ss.getSheetByName(SHEETS.ADS);
  if (adsSheet) {
    const rule = SpreadsheetApp.newDataValidation().requireValueInList(CHANNELS).build();
    adsSheet.getRange('C2:C1000').setDataValidation(rule);
  }
  SpreadsheetApp.getUi().alert('시트 초기화 완료! 4개 시트가 생성되었습니다.');
}

/**
 * GET 요청 처리 - 데이터 조회
 */
function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'all';
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let result;

    switch (action) {
      case 'products':
        result = getSheetData(ss, SHEETS.PRODUCTS);
        break;
      case 'sales':
        result = getSheetData(ss, SHEETS.SALES);
        break;
      case 'ads':
        result = getSheetData(ss, SHEETS.ADS);
        break;
      case 'marketing':
        result = getSheetData(ss, SHEETS.MARKETING);
        break;
      case 'summary':
        result = getSummary(ss);
        break;
      default:
        result = {
          products: getSheetData(ss, SHEETS.PRODUCTS),
          sales: getSheetData(ss, SHEETS.SALES),
          ads: getSheetData(ss, SHEETS.ADS),
          marketing: getSheetData(ss, SHEETS.MARKETING)
        };
    }

    return ContentService.createTextOutput(JSON.stringify({ success: true, data: result, timestamp: new Date().toISOString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * POST 요청 처리 - 데이터 저장/업데이트
 */
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let result;

    switch (action) {
      case 'upsert_products':
        result = upsertRows(ss, SHEETS.PRODUCTS, body.data, ['SKU']);
        break;
      case 'upsert_sales':
        result = upsertRows(ss, SHEETS.SALES, body.data, ['날짜', 'SKU', '채널']);
        break;
      case 'upsert_ads':
        result = upsertRows(ss, SHEETS.ADS, body.data, ['날짜', 'SKU', '채널']);
        break;
      case 'upsert_marketing':
        result = upsertRows(ss, SHEETS.MARKETING, body.data, ['ID']);
        break;
      case 'append_sales':
        result = appendRows(ss, SHEETS.SALES, body.data);
        break;
      case 'append_ads':
        result = appendRows(ss, SHEETS.ADS, body.data);
        break;
      case 'bulk_upload':
        result = bulkUpload(ss, body.sheet, body.data, body.keys || []);
        break;
      default:
        result = { error: 'Unknown action: ' + action };
    }

    return ContentService.createTextOutput(JSON.stringify({ success: true, result, timestamp: new Date().toISOString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 시트 데이터를 JSON 배열로 변환
 */
function getSheetData(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      let val = row[i];
      // 날짜 객체를 문자열로 변환
      if (val instanceof Date) {
        val = Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      }
      obj[h] = val;
    });
    return obj;
  }).filter(obj => {
    // 빈 행 제거
    return Object.values(obj).some(v => v !== '' && v !== null && v !== undefined);
  });
}

/**
 * Upsert (키 기준으로 업데이트 또는 삽입)
 * keys: 중복 체크할 컬럼 배열 (예: ['날짜', 'SKU', '채널'])
 */
function upsertRows(ss, sheetName, rows, keys) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { error: 'Sheet not found: ' + sheetName };

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const existing = sheet.getDataRange().getValues();
  const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');

  let updated = 0, inserted = 0;

  rows.forEach(row => {
    // 키 값으로 기존 행 찾기
    const keyIndices = keys.map(k => headers.indexOf(k));
    let foundRow = -1;

    for (let i = 1; i < existing.length; i++) {
      const match = keyIndices.every((ki, j) => {
        let existVal = existing[i][ki];
        let newVal = row[keys[j]];
        if (existVal instanceof Date) existVal = Utilities.formatDate(existVal, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        return String(existVal) === String(newVal);
      });
      if (match) { foundRow = i; break; }
    }

    const rowData = headers.map(h => {
      if (h === '수정일' || h === '등록일') return now;
      return row[h] !== undefined ? row[h] : '';
    });

    if (foundRow >= 0) {
      // 업데이트
      sheet.getRange(foundRow + 1, 1, 1, headers.length).setValues([rowData]);
      existing[foundRow] = rowData;
      updated++;
    } else {
      // 삽입
      sheet.appendRow(rowData);
      existing.push(rowData);
      inserted++;
    }
  });

  return { updated, inserted, total: rows.length };
}

/**
 * 단순 추가 (중복 체크 없음)
 */
function appendRows(ss, sheetName, rows) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { error: 'Sheet not found: ' + sheetName };

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');

  const rowsData = rows.map(row => headers.map(h => {
    if (h === '등록일') return now;
    return row[h] !== undefined ? row[h] : '';
  }));

  if (rowsData.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rowsData.length, headers.length).setValues(rowsData);
  }

  return { inserted: rowsData.length };
}

/**
 * 대량 업로드 (기존 데이터 유지 + 키 기준 upsert)
 */
function bulkUpload(ss, sheetName, rows, keys) {
  if (!HEADERS[sheetName]) return { error: 'Invalid sheet: ' + sheetName };

  if (keys && keys.length > 0) {
    return upsertRows(ss, sheetName, rows, keys);
  } else {
    return appendRows(ss, sheetName, rows);
  }
}

/**
 * 요약 통계
 */
function getSummary(ss) {
  const products = getSheetData(ss, SHEETS.PRODUCTS);
  const sales = getSheetData(ss, SHEETS.SALES);
  const ads = getSheetData(ss, SHEETS.ADS);
  const marketing = getSheetData(ss, SHEETS.MARKETING);

  // 채널별 집계
  const channelSummary = {};
  sales.forEach(s => {
    const ch = s['채널'] || '기타';
    if (!channelSummary[ch]) channelSummary[ch] = { revenue: 0, units: 0, count: 0 };
    channelSummary[ch].revenue += Number(s['매출']) || 0;
    channelSummary[ch].units += Number(s['판매수량']) || 0;
    channelSummary[ch].count++;
  });

  return {
    productCount: products.length,
    salesRecords: sales.length,
    adsRecords: ads.length,
    marketingRecords: marketing.length,
    channels: Object.keys(channelSummary),
    channelSummary,
    lastSalesDate: sales.length > 0 ? sales[sales.length - 1]['날짜'] : null,
    lastAdsDate: ads.length > 0 ? ads[ads.length - 1]['날짜'] : null
  };
}

/**
 * 메뉴 추가
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('ROI Analyzer')
    .addItem('시트 초기화', 'initSheets')
    .addItem('데이터 요약 보기', 'showSummary')
    .addToUi();
}

function showSummary() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const summary = getSummary(ss);
  const msg = `📊 ROI Analyzer 데이터 현황\n\n` +
    `상품: ${summary.productCount}개\n` +
    `판매 기록: ${summary.salesRecords}건\n` +
    `광고 기록: ${summary.adsRecords}건\n` +
    `마케팅 비용: ${summary.marketingRecords}건\n` +
    `채널: ${summary.channels.join(', ')}\n` +
    `최근 판매일: ${summary.lastSalesDate || '없음'}\n` +
    `최근 광고일: ${summary.lastAdsDate || '없음'}`;
  SpreadsheetApp.getUi().alert(msg);
}
