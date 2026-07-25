/**
 * Google Apps Script to expose Viva Proctor responses from Google Sheet as a JSON API,
 * and support adding new reviews via POST requests.
 * 
 * Instructions:
 * 1. Open the Google Sheet: https://docs.google.com/spreadsheets/d/1spkWbGXI_ZUpDbTWYzXAOtmdXOV1JVTXb76iX4171aw/edit
 * 2. Click Extensions > Apps Script.
 * 3. Delete any code in the editor and paste this code.
 * 4. Click Save (Disk icon).
 * 5. Click Deploy > New deployment.
 * 6. Select "Web app" as the deployment type.
 * 7. Set:
 *    - Execute as: "Me (your-email@gmail.com)"
 *    - Who has access: "Anyone" (This is crucial to allow the website to fetch/post without login).
 * 8. Click Deploy. Authorize permissions when prompted.
 * 9. Copy the Web App URL (ends with "/exec") and configure it in your website's environment variables.
 */

function doGet(e) {
  try {
    var spreadsheetId = "1spkWbGXI_ZUpDbTWYzXAOtmdXOV1JVTXb76iX4171aw";
    var sheet = SpreadsheetApp.openById(spreadsheetId).getSheets()[0];
    
    var startRow = 4;
    var lastRow = sheet.getLastRow();
    
    if (lastRow < startRow) {
      return createJsonResponse([]);
    }
    
    var dataRange = sheet.getRange(startRow, 1, lastRow - startRow + 1, 6);
    var values = dataRange.getValues();
    
    var results = [];
    for (var i = 0; i < values.length; i++) {
      var row = values[i];
      var rawPid = String(row[3] || '').trim();
      
      if (!rawPid || rawPid.toLowerCase() === 'none' || rawPid.toLowerCase() === 'null') {
        continue;
      }
      
      var questionsRaw = String(row[4] || '');
      var questions = cleanQuestions(questionsRaw);
      
      var submissionDate = "";
      if (row[0]) {
        try {
          var dateObj = new Date(row[0]);
          if (!isNaN(dateObj.getTime())) {
            submissionDate = Utilities.formatDate(dateObj, Session.getScriptTimeZone(), "MMMM dd, yyyy");
          } else {
            submissionDate = String(row[0]);
          }
        } catch (err) {
          submissionDate = String(row[0]);
        }
      }
      
      var rawTimestamp = 0;
      if (row[0]) {
        try {
          var dateObj = new Date(row[0]);
          rawTimestamp = dateObj.getTime();
        } catch (err) {}
      }
      
      results.push({
        id: i + 1,
        studentName: String(row[1] || '').trim() || "Anonymous Student",
        vivaDate: String(row[2] || '').trim(),
        submissionDate: submissionDate,
        rawTimestamp: rawTimestamp,
        proctorId: rawPid,
        normalizedProctorId: rawPid.replace(/[^a-zA-Z0-9]/g, "").toLowerCase(),
        questions: questions,
        suggestions: String(row[5] || '').trim()
      });
    }
    
    return createJsonResponse(results);
  } catch (error) {
    return createJsonResponse({ error: error.toString() }, 500);
  }
}

/**
 * Handle new review submissions from the website.
 */
function doPost(e) {
  try {
    var postData;
    if (e.postData && e.postData.contents) {
      postData = JSON.parse(e.postData.contents);
    } else {
      postData = e.parameter;
    }
    
    var spreadsheetId = "1spkWbGXI_ZUpDbTWYzXAOtmdXOV1JVTXb76iX4171aw";
    var sheet = SpreadsheetApp.openById(spreadsheetId).getSheets()[0];
    
    // Extract parameters
    var timestamp = new Date();
    var name = String(postData.studentName || '').trim();
    var date = String(postData.vivaDate || '').trim();
    var proctorId = String(postData.proctorId || '').trim();
    var suggestions = String(postData.suggestions || '').trim();
    
    // Questions can be an array of strings or a single string
    var questions = postData.questions;
    if (Array.isArray(questions)) {
      questions = questions.join("\n");
    } else {
      questions = String(questions || '').trim();
    }
    
    if (!proctorId) {
      return createJsonResponse({ error: "Proctor ID is required" }, 400);
    }
    
    // Append to sheet: A: Timestamp, B: Name, C: Date, D: Proctor ID, E: Questions, F: Suggestions
    sheet.appendRow([timestamp, name, date, proctorId, questions, suggestions]);
    
    return createJsonResponse({ success: true, message: "Review appended successfully" });
  } catch (error) {
    return createJsonResponse({ error: error.toString() }, 500);
  }
}

function cleanQuestions(text) {
  if (!text) return [];
  var lines = text.split(/\r?\n|•|\b\d+[\)\.]\s+/);
  var cleaned = [];
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (line && line.length > 1) {
      line = line.replace(/^[-*\s+]+/, '').trim();
      if (line) {
        cleaned.push(line);
      }
    }
  }
  return cleaned;
}

function createJsonResponse(data, statusCode) {
  var JSONString = JSON.stringify(data);
  var output = ContentService.createTextOutput(JSONString)
    .setMimeType(ContentService.MimeType.JSON);
    
  // Google Apps Script Web App responses automatically handle CORS for GET/POST requests
  return output;
}
