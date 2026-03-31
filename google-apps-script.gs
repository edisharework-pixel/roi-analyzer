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

var SHEETS = {
  PRODUCTS: '상품원가',
  SALES: '판매데이터',
  ADS: '광고비데이터',
  MARKETING: '마케팅비용'
};

var HEADERS = {
  '상품원가': ['SKU', '상품명', '카테고리', '판매가', '원가', '물류비', '발주수량', '투자금액', '키워드', '제조사', '이미지URL', '등록일', '수정일'],
  '판매데이터': ['날짜', 'SKU', '채널', '매출', '판매수량', '반품수량', '수수료', '수수료율', '리뷰수', '평점', '반품률', '등록일'],
  '광고비데이터': ['날짜', 'SKU', '채널', '광고비', '노출수', '클릭수', '전환수', 'CPC', 'CTR', 'CVR', '등록일'],
  '마케팅비용': ['ID', 'SKU', '유형', '항목명', '금액', '기대매출', '시작일', '종료일', '상태', '메모', '등록일']
};

var CHANNELS = ['쿠팡', '네이버', '네이버2', '지마켓', '11번가', '옥션', '자사몰', '기타'];

/**
 * 초기화 - 시트 및 헤더 자동 생성
 */
function initSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetNames = Object.keys(HEADERS);
  for (var s = 0; s < sheetNames.length; s++) {
    var name = sheetNames[s];
    var headers = HEADERS[name];
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
    }
    var firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
    if (!firstRow[0]) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      sheet.getRange(1, 1, 1, headers.length).setBackground('#F1F5F9');
      sheet.setFrozenRows(1);
    }
  }
  var salesSheet = ss.getSheetByName(SHEETS.SALES);
  if (salesSheet) {
    var rule = SpreadsheetApp.newDataValidation().requireValueInList(CHANNELS).build();
    salesSheet.getRange('C2:C1000').setDataValidation(rule);
  }
  var adsSheet = ss.getSheetByName(SHEETS.ADS);
  if (adsSheet) {
    var rule2 = SpreadsheetApp.newDataValidation().requireValueInList(CHANNELS).build();
    adsSheet.getRange('C2:C1000').setDataValidation(rule2);
  }
  SpreadsheetApp.getUi().alert('시트 초기화 완료! 4개 시트가 생성되었습니다.');
}

/**
 * GET 요청 처리 - 데이터 조회
 */
function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) || 'all';
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var result;

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
    var body = JSON.parse(e.postData.contents);
    var action = body.action;
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var result;

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

    return ContentService.createTextOutput(JSON.stringify({ success: true, result: result, timestamp: new Date().toISOString() }))
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
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  var headers = data[0];
  var results = [];
  for (var i = 1; i < data.length; i++) {
    var obj = {};
    var hasValue = false;
    for (var j = 0; j < headers.length; j++) {
      var val = data[i][j];
      if (val instanceof Date) {
        val = Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      }
      obj[headers[j]] = val;
      if (val !== '' && val !== null && val !== undefined) hasValue = true;
    }
    if (hasValue) results.push(obj);
  }
  return results;
}

/**
 * Upsert (키 기준으로 업데이트 또는 삽입)
 */
function upsertRows(ss, sheetName, rows, keys) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { error: 'Sheet not found: ' + sheetName };

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var existing = sheet.getDataRange().getValues();
  var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');

  var updated = 0;
  var inserted = 0;

  for (var r = 0; r < rows.length; r++) {
    var row = rows[r];
    var keyIndices = [];
    for (var ki = 0; ki < keys.length; ki++) {
      keyIndices.push(headers.indexOf(keys[ki]));
    }
    var foundRow = -1;

    for (var i = 1; i < existing.length; i++) {
      var match = true;
      for (var k = 0; k < keyIndices.length; k++) {
        var existVal = existing[i][keyIndices[k]];
        var newVal = row[keys[k]];
        if (existVal instanceof Date) {
          existVal = Utilities.formatDate(existVal, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        }
        if (String(existVal) !== String(newVal)) {
          match = false;
          break;
        }
      }
      if (match) { foundRow = i; break; }
    }

    var rowData = [];
    for (var h = 0; h < headers.length; h++) {
      if (headers[h] === '수정일' || headers[h] === '등록일') {
        rowData.push(now);
      } else {
        rowData.push(row[headers[h]] !== undefined ? row[headers[h]] : '');
      }
    }

    if (foundRow >= 0) {
      sheet.getRange(foundRow + 1, 1, 1, headers.length).setValues([rowData]);
      existing[foundRow] = rowData;
      updated++;
    } else {
      sheet.appendRow(rowData);
      existing.push(rowData);
      inserted++;
    }
  }

  return { updated: updated, inserted: inserted, total: rows.length };
}

/**
 * 단순 추가 (중복 체크 없음)
 */
function appendRows(ss, sheetName, rows) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { error: 'Sheet not found: ' + sheetName };

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');

  var rowsData = [];
  for (var r = 0; r < rows.length; r++) {
    var rowData = [];
    for (var h = 0; h < headers.length; h++) {
      if (headers[h] === '등록일') {
        rowData.push(now);
      } else {
        rowData.push(rows[r][headers[h]] !== undefined ? rows[r][headers[h]] : '');
      }
    }
    rowsData.push(rowData);
  }

  if (rowsData.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rowsData.length, headers.length).setValues(rowsData);
  }

  return { inserted: rowsData.length };
}

/**
 * 대량 업로드
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
  var products = getSheetData(ss, SHEETS.PRODUCTS);
  var sales = getSheetData(ss, SHEETS.SALES);
  var ads = getSheetData(ss, SHEETS.ADS);
  var marketing = getSheetData(ss, SHEETS.MARKETING);

  var channelSummary = {};
  for (var i = 0; i < sales.length; i++) {
    var ch = sales[i]['채널'] || '기타';
    if (!channelSummary[ch]) channelSummary[ch] = { revenue: 0, units: 0, count: 0 };
    channelSummary[ch].revenue += Number(sales[i]['매출']) || 0;
    channelSummary[ch].units += Number(sales[i]['판매수량']) || 0;
    channelSummary[ch].count++;
  }

  return {
    productCount: products.length,
    salesRecords: sales.length,
    adsRecords: ads.length,
    marketingRecords: marketing.length,
    channels: Object.keys(channelSummary),
    channelSummary: channelSummary,
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
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var summary = getSummary(ss);
  var msg = '📊 ROI Analyzer 데이터 현황\n\n' +
    '상품: ' + summary.productCount + '개\n' +
    '판매 기록: ' + summary.salesRecords + '건\n' +
    '광고 기록: ' + summary.adsRecords + '건\n' +
    '마케팅 비용: ' + summary.marketingRecords + '건\n' +
    '채널: ' + summary.channels.join(', ') + '\n' +
    '최근 판매일: ' + (summary.lastSalesDate || '없음') + '\n' +
    '최근 광고일: ' + (summary.lastAdsDate || '없음');
  SpreadsheetApp.getUi().alert(msg);
}
