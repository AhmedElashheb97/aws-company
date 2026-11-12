/**
 * AWS COMPANY — نسخة احتياطية يومية من Firebase إلى Google Drive
 * يتركّب في script.google.com بحساب Google اللي تبي النسخ تتخزن في الدرايف متاعه.
 *
 * كل يوم يقرأ: cars, customers, containers, log, meta/settings
 * ويكتب ملف  car-office-backup-YYYY-MM-DD.json  في مجلد "AWS COMPANY - نسخ احتياطية".
 * الملف بنفس شكل زر "تصدير نسخة" في البرنامج، فيتستورد من الإعدادات ← "استيراد نسخة".
 *
 * الإعداد (مرة وحدة): Project Settings ← Script properties، ضيف:
 *   BACKUP_EMAIL     بريد مستخدم يقدر يدخل البرنامج
 *   BACKUP_PASSWORD  كلمة السر متاعه
 * بعدها شغّل الدالة setup مرة وحدة ووافق على الصلاحيات.
 */
const PROJECT_ID = 'aws-company';
const API_KEY = 'AIzaSyAsRrDJfP_BQ7PV2AU7BWSsvLUnep4ysr0';            // مفتاح الويب متاع Firebase (نفس اللي في firebase-config.js، مش سري)
const FOLDER_NAME = 'AWS COMPANY - نسخ احتياطية';
const KEEP_DAYS = 90;                // النسخ الأقدم من هكي تمشي لسلة المهملات
const BACKUP_HOUR = 3;               // الساعة 3 الصبح بتوقيت المشروع
const FILE_RE = /^car-office-backup-\d{4}-\d{2}-\d{2}\.json$/;

/** شغّلها مرة وحدة: تجرّب الدخول، تاخذ أول نسخة، وتركّب الموعد اليومي. */
function setup() {
  const res = runBackup_();
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'dailyBackup').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('dailyBackup').timeBased().everyDays(1).atHour(BACKUP_HOUR).create();
  Logger.log('تمام ✓ أول نسخة: ' + res.name + ' — ' + JSON.stringify(res.counts) + ' — الموعد اليومي تركّب.');
}

/** هذي اللي يشغّلها الموعد اليومي. لو فشلت تبعتلك إيميل. */
function dailyBackup() {
  try {
    const res = runBackup_();
    Logger.log('نسخة: ' + res.name + ' ' + JSON.stringify(res.counts));
  } catch (e) {
    try {
      MailApp.sendEmail(Session.getEffectiveUser().getEmail(), 'AWS COMPANY: النسخة الاحتياطية فشلت', 'النسخة الاحتياطية اليومية ما تمّتش.\n\nالسبب: ' + (e && e.message || e));
    } catch (e2) {}
    throw e;
  }
}

function runBackup_() {
  const token = signIn_();
  const data = {
    cars: listAll_('cars', token).map(c => Object.assign({expenses: [], payments: [], refunds: []}, c)),
    customers: listAll_('customers', token),
    containers: listAll_('containers', token),
    settings: getDoc_('meta/settings', token) || {},
    log: listAll_('log', token).sort((a, b) => String(b.at || '').localeCompare(String(a.at || ''))),
  };
  const counts = {cars: data.cars.length, customers: data.customers.length, containers: data.containers.length, log: data.log.length};
  data._backup = {at: new Date().toISOString(), project: PROJECT_ID, counts: counts};

  const folder = getFolder_();
  const name = 'car-office-backup-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd') + '.json';
  const json = JSON.stringify(data, null, 1);
  const same = folder.getFilesByName(name);
  if (same.hasNext()) same.next().setContent(json);          // نفس اليوم: نحدّث الملف وما نكرروش
  else folder.createFile(name, json, 'application/json');
  cleanup_(folder);
  return {name: name, counts: counts};
}

function signIn_() {
  const p = PropertiesService.getScriptProperties();
  const email = p.getProperty('BACKUP_EMAIL'), password = p.getProperty('BACKUP_PASSWORD');
  if (!email || !password) throw new Error('ضيف BACKUP_EMAIL و BACKUP_PASSWORD في Script properties');
  const r = UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + API_KEY, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    payload: JSON.stringify({email: email, password: password, returnSecureToken: true}),
  });
  const j = JSON.parse(r.getContentText() || '{}');
  if (r.getResponseCode() !== 200 || !j.idToken) throw new Error('تعذر الدخول: ' + ((j.error && j.error.message) || r.getResponseCode()));
  return j.idToken;
}

function fsGet_(path, token) {
  const r = UrlFetchApp.fetch('https://firestore.googleapis.com/v1/projects/' + PROJECT_ID + '/databases/(default)/documents/' + path,
    {headers: {Authorization: 'Bearer ' + token}, muteHttpExceptions: true});
  const code = r.getResponseCode();
  if (code === 404) return null;
  const j = JSON.parse(r.getContentText() || '{}');
  if (code !== 200) throw new Error('تعذر قراءة ' + path.split('?')[0] + ': ' + ((j.error && j.error.message) || code));
  return j;
}

function listAll_(col, token) {
  const out = []; let pageToken = '';
  do {
    const j = fsGet_(col + '?pageSize=300' + (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : ''), token) || {};
    (j.documents || []).forEach(d => out.push(decodeFields_(d.fields || {})));
    pageToken = j.nextPageToken || '';
  } while (pageToken);
  return out;
}

function getDoc_(path, token) {
  const j = fsGet_(path, token);
  return j ? decodeFields_(j.fields || {}) : null;
}

function decodeFields_(fields) {
  const o = {};
  Object.keys(fields).forEach(k => { o[k] = decodeValue_(fields[k]); });
  return o;
}

function decodeValue_(v) {
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('mapValue' in v) return decodeFields_(v.mapValue.fields || {});
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(decodeValue_);
  if ('referenceValue' in v) return v.referenceValue;
  if ('geoPointValue' in v) return v.geoPointValue;
  if ('bytesValue' in v) return v.bytesValue;
  return null;
}

function getFolder_() {
  const it = DriveApp.getFoldersByName(FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(FOLDER_NAME);
}

/** يمشّي لسلة المهملات ملفات النسخ الأقدم من KEEP_DAYS — من مجلد النسخ بس، وبالاسم هذا بس. */
function cleanup_(folder) {
  const limit = Date.now() - KEEP_DAYS * 24 * 3600 * 1000;
  const it = folder.getFiles();
  while (it.hasNext()) {
    const f = it.next();
    if (FILE_RE.test(f.getName()) && f.getDateCreated().getTime() < limit) f.setTrashed(true);
  }
}
