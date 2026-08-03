/**
 * @OnlyCurrentDoc
 */

const PA_SCHEMA_VERSION = 2;
const PA_PROJECT_ID = 'pickup-arrow';
const PA_META_SHEET = '_meta';
const PA_PROFILE_SHEET = 'stage_profiles';
const PA_GUIDE_SHEET = 'metric_guide';
const PA_PUBLISHED_PREFIX = 'pickup_arrow_published_';
const PA_PUBLISHED_MANIFEST = PA_PUBLISHED_PREFIX + 'manifest';
const PA_PUBLISHED_CHUNK_SIZE = 8000;
const PA_PUBLISHED_PAYLOAD_LIMIT = 450000;

const PA_FIELDS = [
  { id: 'stage_id', type: 'string', required: true, group: 'identity', range: 'unique stable ID', description: '스테이지를 식별하는 변경되지 않는 고유 ID' },
  { id: 'stage_order', type: 'int', required: true, min: 1, group: 'identity', range: '>= 1, unique', description: '게임에서 사용하는 스테이지 진행 순서' },
  { id: 'expected_difficulty_level', type: 'int', required: false, min: 1, max: 100, group: 'difficulty', range: 'blank or 1..100', description: '운영자가 판단해 입력하는 예상 난이도' },
  { id: 'grid_width', type: 'int', required: true, min: 1, max: 999, group: 'board', range: '1..999', description: '격자의 가로 셀 수' },
  { id: 'grid_height', type: 'int', required: true, min: 1, max: 999, group: 'board', range: '1..999; width x height <= 10000', description: '격자의 세로 셀 수' },
  { id: 'seed', type: 'int', required: true, min: 0, max: 2147483647, group: 'generation', range: '0..2147483647', description: '같은 결과를 재현하기 위한 기본 시드' },
  { id: 'generation_mode', type: 'string', required: true, allowedValues: ['fixed', 'random'], group: 'generation', range: 'fixed 또는 random', description: '플레이마다 같은 맵을 쓸지 새 맵을 생성할지 정하는 모드' },
  { id: 'primary_arrow_count', type: 'int', required: true, min: 1, group: 'generation', range: '1..playable cell count', description: '우선 배치할 기본 화살 수' },
  { id: 'min_length', type: 'int', required: true, min: 1, group: 'generation', range: '1..playable cell count', description: '기본 화살의 최소 길이' },
  { id: 'max_length', type: 'int', required: true, min: 1, group: 'generation', range: 'min_length..playable cell count', description: '기본 화살의 최대 길이' },
  { id: 'target_empty_ratio', type: 'float', required: true, min: 0, max: 1, group: 'generation', range: '0.0..1.0', description: '생성 완료 후 목표 빈 셀 비율' },
  { id: 'filler_max_length', type: 'int', required: true, min: 1, group: 'generation', range: '1..playable cell count', description: '빈 공간을 채우는 보충 화살의 최대 길이' },
  { id: 'min_dependency_depth', type: 'int', required: true, min: 1, group: 'dependency', range: '>= 1', description: '허용할 최소 의존 단계 깊이' },
  { id: 'max_dependency_depth', type: 'int', required: true, min: 1, group: 'dependency', range: '>= minimum', description: '허용할 최대 의존 단계 깊이' },
  { id: 'min_initial_extractable_ratio', type: 'float', required: true, min: 0, max: 1, group: 'dependency', range: '0.0..1.0', description: '시작 시 바로 제거 가능한 화살 비율의 최솟값' },
  { id: 'max_initial_extractable_ratio', type: 'float', required: true, min: 0, max: 1, group: 'dependency', range: 'minimum..1.0', description: '시작 시 바로 제거 가능한 화살 비율의 최댓값' },
  { id: 'min_forced_state_ratio', type: 'float', required: true, min: 0, max: 1, group: 'dependency', range: '0.0..1.0', description: '채택에는 사용하지 않는 강제 진행 비율 참고 범위의 최솟값' },
  { id: 'max_forced_state_ratio', type: 'float', required: true, min: 0, max: 1, group: 'dependency', range: 'minimum..1.0', description: '채택에는 사용하지 않는 강제 진행 비율 참고 범위의 최댓값' },
  { id: 'max_candidate_attempts', type: 'int', required: true, min: 1, max: 256, defaultValue: 64, group: 'budget', range: '1..256', description: '조건에 맞는 보드를 찾기 위한 최대 후보 생성 횟수' },
  { id: 'operator_note', type: 'string', required: false, group: 'operations', range: 'free text', description: '운영자 메모이며 게임 데이터에는 포함되지 않음' },
];

const PA_PROFILE_COLUMNS = PA_FIELDS.map((field) => field.id);
const PA_V1_PROFILE_COLUMNS = PA_PROFILE_COLUMNS.filter((field) => field !== 'generation_mode');
const PA_GUIDE_COLUMNS = [
  'metric_id', 'classification', 'group', 'value_type', 'required',
  'allowed_range', 'default_value', 'stage_profiles_column', 'description',
];

const PA_META_ROWS = [
  ['key', 'value', 'description'],
  ['schema_version', PA_SCHEMA_VERSION, 'Balance sheet schema version'],
  ['project_id', PA_PROJECT_ID, 'Owning project'],
  ['profile_sheet', PA_PROFILE_SHEET, 'Operational stage profile source'],
  ['metric_guide_sheet', PA_GUIDE_SHEET, 'Metric definitions'],
];

const PA_INITIAL_PROFILES = [
  ['STAGE-001', 1, '', 9, 9, 1001, 'fixed', 3, 1, 6, 0.70, 3, 2, 4, 0.50, 1.00, 0.00, 0.25, 64, ''],
  ['STAGE-002', 2, '', 9, 9, 2002, 'fixed', 4, 3, 10, 0.55, 3, 3, 5, 0.30, 0.60, 0.10, 0.40, 64, ''],
  ['STAGE-003', 3, '', 9, 9, 3003, 'fixed', 5, 5, 14, 0.40, 3, 4, 8, 0.00, 0.40, 0.20, 1.00, 64, ''],
  ['STAGE-004', 4, '', 9, 9, 4004, 'random', 5, 5, 14, 0.40, 3, 4, 8, 0.00, 0.40, 0.20, 1.00, 64, ''],
];

const PA_OBSERVED_METRICS = [
  ['node_count', 'generation', 'int', '>= 1', '실제로 생성된 전체 화살 수'],
  ['filler_arrow_count', 'generation', 'int', '>= 0', '실제로 생성된 보충 화살 수'],
  ['occupied_cell_count', 'generation', 'int', '>= 1', '화살이 차지한 배치 가능 셀 수'],
  ['actual_empty_ratio', 'generation', 'float', '0.0..1.0', '생성 결과에서 측정된 실제 빈 셀 비율'],
  ['edge_count', 'dependency', 'int', '>= 0', '화살 의존 관계 그래프의 연결 수'],
  ['dependency_depth', 'dependency', 'int', '>= 0', '생성 결과에서 측정된 의존 단계 깊이'],
  ['initial_extractable_count', 'dependency', 'int', '>= 0', '시작 시 바로 제거 가능한 화살 수'],
  ['initial_extractable_ratio', 'dependency', 'float', '0.0..1.0', '시작 시 바로 제거 가능한 화살의 실제 비율'],
  ['forced_state_count', 'dependency', 'int', '>= 0', '선택지가 하나뿐인 진행 상태 수'],
  ['forced_state_ratio', 'dependency', 'float', '0.0..1.0', '선택지가 하나뿐인 진행 상태의 실제 비율'],
  ['average_choice_count', 'dependency', 'float', '>= 0.0', '해결 과정에서 선택 가능한 화살 수의 평균'],
  ['choice_counts', 'dependency', 'int_array', 'each >= 0', '해결 단계마다 선택 가능한 화살 수 목록'],
  ['attempt_count', 'budget', 'int', '1..max_candidate_attempts', '조건에 맞는 후보를 찾을 때 사용한 시도 횟수'],
  ['selected_seed', 'generation', 'int', '0..2147483647+', '최종 선택된 후보의 결정적 시드'],
  ['has_complete_solution', 'dependency', 'bool', 'true or false', '모든 화살을 제거하는 완전한 해답 존재 여부'],
];

const PA_DEFERRED_METRICS = [
  ['adoption_target_metrics', 'generation', 'future', 'deferred', '전체 화살 수와 평균 선택지 등 향후 후보 채택 조건'],
  ['shape_visual_metrics', 'shape', 'future', 'deferred', '길이 분산, 꺾임, 방향 편중, 지역 밀도 등 형상 지표'],
  ['advanced_dependency_metrics', 'dependency', 'future', 'deferred', '진입·진출 차수, 밀도, 구성요소, 모듈, 관문 등 고급 의존 지표'],
  ['play_constraint_metrics', 'play', 'future', 'deferred', '시간, 실수, 힌트, 플레이 속도 등 향후 제약 지표'],
];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Pickup Arrow')
    .addItem('최초 구성', 'pickupArrowInitialSetup')
    .addItem('구조 마이그레이션', 'pickupArrowMigrateSchema')
    .addSeparator()
    .addItem('데이터 검증', 'pickupArrowValidateData')
    .addToUi();
}

function doGet() {
  const lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(5000)) throw new Error('게시 데이터를 읽는 중 다른 작업이 실행 중입니다.');
    return paJsonOutput_(paLoadPublishedSnapshot_());
  } catch (error) {
    return paJsonOutput_({ ok: false, error: String(error.message || error) });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function pickupArrowInitialSetup() {
  const ui = SpreadsheetApp.getUi();
  const answer = ui.alert(
    'Pickup Arrow 최초 구성',
    '현재 빈 스프레드시트에 표준 탭과 초기 스테이지를 생성합니다.',
    ui.ButtonSet.OK_CANCEL,
  );
  if (answer !== ui.Button.OK) return;

  paRunLocked_('최초 구성', () => {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    if (!paIsBlankSpreadsheet_(spreadsheet)) {
      throw new Error('최초 구성은 새 빈 스프레드시트에서만 실행할 수 있습니다.');
    }

    const metaSheet = spreadsheet.getSheets()[0].setName(PA_META_SHEET);
    const profileSheet = spreadsheet.insertSheet(PA_PROFILE_SHEET);
    const guideSheet = spreadsheet.insertSheet(PA_GUIDE_SHEET);
    const guideRows = paGuideRows_();

    paWriteTable_(metaSheet, PA_META_ROWS);
    paWriteTable_(profileSheet, [PA_PROFILE_COLUMNS].concat(PA_INITIAL_PROFILES));
    paWriteTable_(guideSheet, [PA_GUIDE_COLUMNS].concat(guideRows));
    paApplyProfileRules_(profileSheet);
    paProtectWithWarning_(metaSheet.getRange(1, 1, PA_META_ROWS.length, 3), 'Pickup Arrow schema metadata');
    paProtectWithWarning_(profileSheet.getRange(1, 1, 1, PA_PROFILE_COLUMNS.length), 'Pickup Arrow profile header');
    paProtectWithWarning_(guideSheet.getRange(1, 1, guideRows.length + 1, PA_GUIDE_COLUMNS.length), 'Pickup Arrow metric guide');

    const result = paValidateWorkbook_(spreadsheet);
    if (!result.isValid) throw new Error(result.issues.join('\n'));
    const snapshot = paSnapshotFromValidation_(result);
    paPublishSnapshot_(snapshot);
    ui.alert('최초 구성 완료', '스테이지 4개와 표준 탭을 생성하고 동기화 데이터를 게시했습니다.', ui.ButtonSet.OK);
  });
}

function pickupArrowMigrateSchema() {
  paRunLocked_('구조 마이그레이션', () => {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const metaSheet = spreadsheet.getSheetByName(PA_META_SHEET);
    if (!metaSheet) throw new Error('_meta 탭이 없습니다. 먼저 최초 구성을 실행하세요.');

    const currentVersion = Number(metaSheet.getRange('B2').getValue());
    if (currentVersion === 1) {
      const migration = paMigrateV1ToV2_(spreadsheet);
      const migrated = paValidateWorkbook_(spreadsheet);
      if (!migrated.isValid) throw new Error(migrated.issues.join('\n'));
      paPublishSnapshot_(paSnapshotFromValidation_(migrated));
      SpreadsheetApp.getUi().alert(
        '구조 마이그레이션 완료',
        'schema v2와 generation_mode를 적용하고 STAGE-004를 random으로 등록했습니다. 기존 탭'
          + (migration.archivedExtraData ? '과 표준 범위 밖 데이터는' : '은')
          + ' 숨겨진 백업에 보존했습니다.',
        SpreadsheetApp.getUi().ButtonSet.OK,
      );
      return;
    }
    if (currentVersion === PA_SCHEMA_VERSION) {
      const guideSheet = spreadsheet.getSheetByName(PA_GUIDE_SHEET);
      const expectedGuide = [PA_GUIDE_COLUMNS].concat(paGuideRows_());
      let guideRefreshed = false;
      let interruptedMigrationRecovered = false;
      if (guideSheet && !paTableMatches_(guideSheet, expectedGuide)) {
        const backupName = '_backup_' + new Date().toISOString().replace(/[-:.TZ]/g, '') + '_' + PA_GUIDE_SHEET;
        guideSheet.copyTo(spreadsheet).setName(backupName).hideSheet();
        guideSheet.clearContents();
        paWriteTable_(guideSheet, expectedGuide);
        guideRefreshed = true;
      }
      let result = paValidateWorkbook_(spreadsheet);
      if (!result.isValid && paHasInterruptedV1Migration_(spreadsheet)) {
        paMigrateV1ToV2_(spreadsheet);
        result = paValidateWorkbook_(spreadsheet);
        interruptedMigrationRecovered = true;
      }
      if (!result.isValid) throw new Error(result.issues.join('\n'));
      paPublishSnapshot_(paSnapshotFromValidation_(result));
      SpreadsheetApp.getUi().alert(
        '구조 마이그레이션',
        interruptedMigrationRecovered
          ? '중단된 마이그레이션을 숨겨진 원본 백업에서 복구하고 schema v2를 적용했습니다.'
          : guideRefreshed
          ? '스키마 버전은 최신이며 metric_guide 설명을 한글로 갱신했습니다. 기존 guide는 숨겨진 백업 탭에 보존했습니다.'
          : '현재 스키마 버전은 ' + currentVersion + '이며 이미 최신입니다. 검증된 동기화 데이터도 갱신했습니다.',
        SpreadsheetApp.getUi().ButtonSet.OK,
      );
      return;
    }

    throw new Error(
      '스키마 ' + currentVersion + '에서 ' + PA_SCHEMA_VERSION + '으로 가는 마이그레이션이 아직 정의되지 않았습니다.',
    );
  });
}

function paMigrateV1ToV2_(spreadsheet) {
  const profileSheet = spreadsheet.getSheetByName(PA_PROFILE_SHEET);
  const guideSheet = spreadsheet.getSheetByName(PA_GUIDE_SHEET);
  if (!profileSheet || !guideSheet) throw new Error('stage_profiles와 metric_guide 탭이 필요합니다.');
  const sourceSheet = paFindV1MigrationSource_(spreadsheet, profileSheet);
  const detectedHeader = sourceSheet.getRange(1, 1, 1, PA_PROFILE_COLUMNS.length).getValues()[0];
  const hasV2Header = PA_PROFILE_COLUMNS.every((field, index) => detectedHeader[index] === field);
  const sourceColumnCount = hasV2Header ? PA_PROFILE_COLUMNS.length : PA_V1_PROFILE_COLUMNS.length;
  let archivedExtraData = false;
  if (sourceSheet.getLastColumn() > sourceColumnCount) {
    const extra = sourceSheet.getRange(
      1,
      sourceColumnCount + 1,
      Math.max(sourceSheet.getLastRow(), 1),
      sourceSheet.getLastColumn() - sourceColumnCount,
    ).getValues();
    archivedExtraData = extra.some((row) => row.some((value) => !paIsBlank_(value)));
  }

  const table = sourceSheet.getRange(
    1,
    1,
    Math.max(sourceSheet.getLastRow(), 1),
    sourceColumnCount,
  ).getValues();
  const migratedTable = paMigrateV1ProfileValues_(table);
  const suffix = new Date().toISOString().replace(/[-:.TZ]/g, '');
  profileSheet.copyTo(spreadsheet).setName('_backup_' + suffix + '_' + PA_PROFILE_SHEET).hideSheet();
  guideSheet.copyTo(spreadsheet).setName('_backup_' + suffix + '_' + PA_GUIDE_SHEET).hideSheet();

  profileSheet.getRange(
    1,
    1,
    profileSheet.getMaxRows(),
    profileSheet.getMaxColumns(),
  ).clearDataValidations();
  profileSheet.clearContents();
  paWriteTable_(profileSheet, migratedTable);
  guideSheet.clearContents();
  paWriteTable_(guideSheet, [PA_GUIDE_COLUMNS].concat(paGuideRows_()));
  spreadsheet.getSheetByName(PA_META_SHEET).getRange('B2').setValue(PA_SCHEMA_VERSION);
  paApplyProfileRules_(profileSheet);
  paProtectWithWarning_(profileSheet.getRange(1, 1, 1, PA_PROFILE_COLUMNS.length), 'Pickup Arrow profile header v2');
  paProtectWithWarning_(guideSheet.getRange(1, 1, paGuideRows_().length + 1, PA_GUIDE_COLUMNS.length), 'Pickup Arrow metric guide v2');
  return { archivedExtraData: archivedExtraData, recoveredFromBackup: sourceSheet !== profileSheet };
}

function paFindV1MigrationSource_(spreadsheet, profileSheet) {
  const backupSheets = spreadsheet.getSheets().filter((sheet) => (
    /^_backup_\d+_stage_profiles$/.test(sheet.getName())
  )).reverse();
  const candidates = [profileSheet].concat(backupSheets);
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    const table = paReadMigrationTable_(candidate);
    if (table && paMigrationTableIsRecoverable_(table)) return candidate;
  }
  throw new Error('완전한 stage_profiles 원본을 찾지 못했습니다. 숨겨진 백업 탭을 보존한 채 지원을 요청하세요.');
}

function paReadMigrationTable_(sheet) {
  const header = sheet.getRange(1, 1, 1, PA_PROFILE_COLUMNS.length).getValues()[0];
  const hasV2Header = PA_PROFILE_COLUMNS.every((field, index) => header[index] === field);
  const hasV1Header = PA_V1_PROFILE_COLUMNS.every((field, index) => header[index] === field);
  if (!hasV1Header && !hasV2Header) return null;
  const columnCount = hasV2Header ? PA_PROFILE_COLUMNS.length : PA_V1_PROFILE_COLUMNS.length;
  return sheet.getRange(1, 1, Math.max(sheet.getLastRow(), 1), columnCount).getValues();
}

function paMigrationTableIsRecoverable_(table) {
  if (!Array.isArray(table) || !Array.isArray(table[0])) return false;
  const hasV2Header = PA_PROFILE_COLUMNS.every((field, index) => table[0][index] === field);
  const header = hasV2Header ? PA_PROFILE_COLUMNS : PA_V1_PROFILE_COLUMNS;
  if (!header.every((field, index) => table[0][index] === field)) return false;
  const requiredIndexes = PA_FIELDS
    .filter((field) => field.required && field.id !== 'generation_mode')
    .map((field) => header.indexOf(field.id));
  const rows = table.slice(1).filter((row) => !paIsBlankRow_(row));
  return rows.length > 0 && rows.every((row) => requiredIndexes.every((index) => (
    index >= 0 && !paIsBlank_(row[index])
  )));
}

function paHasInterruptedV1Migration_(spreadsheet) {
  const profileSheet = spreadsheet.getSheetByName(PA_PROFILE_SHEET);
  if (!profileSheet) return false;
  const table = paReadMigrationTable_(profileSheet);
  if (!table || !PA_PROFILE_COLUMNS.every((field, index) => table[0][index] === field)) return false;
  const rows = table.slice(1).filter((row) => !paIsBlankRow_(row));
  if (rows.length === 0) return false;
  const partialRows = rows.filter((row) => (
    row.slice(0, 7).some((value) => !paIsBlank_(value))
      && row.slice(7, 19).every((value) => paIsBlank_(value))
  ));
  if (partialRows.length === 0) return false;
  return spreadsheet.getSheets().some((sheet) => (
    /^_backup_\d+_stage_profiles$/.test(sheet.getName())
      && paBackupContainsInterruptedRows_(sheet, partialRows)
  ));
}

function paBackupContainsInterruptedRows_(sheet, partialRows) {
  const backupTable = paReadMigrationTable_(sheet);
  if (!paMigrationTableIsRecoverable_(backupTable)) return false;
  const migratedBackup = paMigrateV1ProfileValues_(backupTable);
  const backupStageIds = new Set(
    migratedBackup.slice(1).filter((row) => !paIsBlankRow_(row)).map((row) => String(row[0])),
  );
  return partialRows.every((row) => backupStageIds.has(String(row[0])));
}

function paMigrateV1ProfileValues_(table) {
  if (!Array.isArray(table) || !Array.isArray(table[0])) throw new Error('stage_profiles 표가 올바르지 않습니다.');
  const hasV2Header = PA_PROFILE_COLUMNS.every((field, index) => table[0][index] === field);
  const expectedHeader = hasV2Header ? PA_PROFILE_COLUMNS : PA_V1_PROFILE_COLUMNS;
  expectedHeader.forEach((field, index) => {
    if (table[0][index] !== field) throw new Error('stage_profiles 헤더 ' + paColumnName_(index + 1) + '1은 ' + field + '이어야 합니다.');
  });

  const rows = table.slice(1).map((source) => {
    const row = source.slice(0, expectedHeader.length);
    if (paIsBlankRow_(row)) return Array(PA_PROFILE_COLUMNS.length).fill('');
    if (hasV2Header) {
      if (paIsBlank_(row[6])) row[6] = 'fixed';
      if (row[0] === 'STAGE-004') row[6] = 'random';
    } else {
      row.splice(6, 0, row[0] === 'STAGE-004' ? 'random' : 'fixed');
    }
    return row;
  });
  const stageFour = rows.find((row) => row[0] === 'STAGE-004');
  const orderFour = rows.find((row) => Number(row[1]) === 4);
  if (stageFour && Number(stageFour[1]) !== 4) throw new Error('STAGE-004의 stage_order는 4여야 합니다.');
  if (!stageFour && orderFour) throw new Error('stage_order 4가 이미 사용 중이므로 STAGE-004를 추가할 수 없습니다.');
  if (!stageFour) rows.push(PA_INITIAL_PROFILES[3].slice());
  return [PA_PROFILE_COLUMNS.slice()].concat(rows);
}

function pickupArrowValidateData() {
  const ui = SpreadsheetApp.getUi();
  try {
    const result = paValidateWorkbook_(SpreadsheetApp.getActiveSpreadsheet());
    if (result.isValid) {
      const snapshot = paSnapshotFromValidation_(result);
      paPublishSnapshot_(snapshot);
      ui.alert(
        '데이터 검증 및 게시 완료',
        '스키마 버전: ' + PA_SCHEMA_VERSION + '\n스테이지 수: ' + result.profileCount + '\nrevision: ' + snapshot.source_revision + '\n오류: 0',
        ui.ButtonSet.OK,
      );
      return;
    }

    const shown = result.issues.slice(0, 20);
    const suffix = result.issues.length > shown.length
      ? '\n\n외 ' + (result.issues.length - shown.length) + '개 오류가 더 있습니다.'
      : '';
    ui.alert(
      '데이터 검증 실패',
      '오류 ' + result.issues.length + '개\n\n' + shown.join('\n') + suffix,
      ui.ButtonSet.OK,
    );
  } catch (error) {
    console.error(error);
    ui.alert('데이터 검증·게시 실패', String(error.message || error), ui.ButtonSet.OK);
  }
}

function paRunLocked_(actionName, action) {
  const lock = LockService.getDocumentLock();
  try {
    if (!lock.tryLock(5000)) throw new Error('다른 사용자가 시트 구조를 변경 중입니다. 잠시 후 다시 시도하세요.');
    action();
  } catch (error) {
    console.error(error);
    SpreadsheetApp.getUi().alert(actionName + ' 실패', String(error.message || error), SpreadsheetApp.getUi().ButtonSet.OK);
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function paIsBlankSpreadsheet_(spreadsheet) {
  const sheets = spreadsheet.getSheets();
  return sheets.length === 1 && sheets[0].getDataRange().isBlank();
}

function paGuideRows_() {
  const configurable = PA_FIELDS.map((field) => [
    field.id,
    'configurable',
    field.group,
    field.type,
    field.required,
    field.range,
    field.defaultValue === undefined ? '' : field.defaultValue,
    field.id,
    field.description,
  ]);
  const observed = PA_OBSERVED_METRICS.map((metric) => [
    metric[0], 'observed', metric[1], metric[2], false, metric[3], '', '', metric[4],
  ]);
  const deferred = PA_DEFERRED_METRICS.map((metric) => [
    metric[0], 'deferred', metric[1], metric[2], false, metric[3], '', '', metric[4],
  ]);
  return configurable.concat(observed, deferred);
}

function paWriteTable_(sheet, rows) {
  sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, rows[0].length)
    .setBackground('#263852')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setWrap(true);
  sheet.autoResizeColumns(1, rows[0].length);
}

function paTableMatches_(sheet, expected) {
  if (sheet.getLastRow() !== expected.length) return false;
  const actual = sheet.getRange(1, 1, expected.length, expected[0].length).getValues();
  return expected.every((row, rowIndex) => row.every((value, columnIndex) => (
    String(actual[rowIndex][columnIndex]) === String(value)
  )));
}

function paProtectWithWarning_(range, description) {
  range.protect().setDescription(description).setWarningOnly(true);
}

function paApplyProfileRules_(sheet) {
  PA_FIELDS.forEach((field, index) => {
    if (field.allowedValues) {
      const rule = SpreadsheetApp.newDataValidation()
        .requireValueInList(field.allowedValues, true)
        .setAllowInvalid(false)
        .setHelpText(field.range)
        .build();
      sheet.getRange(2, index + 1, 999, 1).setDataValidation(rule);
      return;
    }
    if (field.type !== 'int' && field.type !== 'float') return;
    const cell = paColumnName_(index + 1) + '2';
    const conditions = ['ISNUMBER(' + cell + ')'];
    if (field.type === 'int') conditions.push(cell + '=INT(' + cell + ')');
    if (field.min !== undefined) conditions.push(cell + '>=' + field.min);
    if (field.max !== undefined) conditions.push(cell + '<=' + field.max);
    const formula = field.required
      ? '=AND(' + conditions.join(',') + ')'
      : '=OR(' + cell + '="",AND(' + conditions.join(',') + '))';
    const rule = SpreadsheetApp.newDataValidation()
      .requireFormulaSatisfied(formula)
      .setAllowInvalid(false)
      .setHelpText(field.range)
      .build();
    sheet.getRange(2, index + 1, 999, 1).setDataValidation(rule);
  });
}

function paValidateWorkbook_(spreadsheet) {
  const issues = [];
  const metaSheet = spreadsheet.getSheetByName(PA_META_SHEET);
  const profileSheet = spreadsheet.getSheetByName(PA_PROFILE_SHEET);
  const guideSheet = spreadsheet.getSheetByName(PA_GUIDE_SHEET);

  paValidateFixedTable_(metaSheet, PA_META_ROWS, PA_META_SHEET, issues);
  paValidateHeader_(profileSheet, PA_PROFILE_COLUMNS, PA_PROFILE_SHEET, issues);
  paValidateFixedTable_(guideSheet, [PA_GUIDE_COLUMNS].concat(paGuideRows_()), PA_GUIDE_SHEET, issues);

  if (!profileSheet) return { isValid: false, issues: issues, profileCount: 0 };

  const rowCount = Math.max(profileSheet.getLastRow() - 1, 0);
  const values = rowCount > 0
    ? profileSheet.getRange(2, 1, rowCount, PA_PROFILE_COLUMNS.length).getValues()
    : [];
  const formulas = rowCount > 0
    ? profileSheet.getRange(2, 1, rowCount, PA_PROFILE_COLUMNS.length).getFormulas()
    : [];
  const ids = new Map();
  const orders = new Map();
  const profiles = [];
  let profileCount = 0;

  values.forEach((row, rowIndex) => {
    if (paIsBlankRow_(row)) return;
    profileCount += 1;
    const sheetRow = rowIndex + 2;
    const parsed = {};

    PA_FIELDS.forEach((field, columnIndex) => {
      const address = PA_PROFILE_SHEET + '!' + paColumnName_(columnIndex + 1) + sheetRow;
      if (formulas[rowIndex][columnIndex]) issues.push(address + ': 수식은 사용할 수 없습니다.');
      parsed[field.id] = paParseField_(row[columnIndex], field, address, issues);
    });

    if (typeof parsed.stage_id === 'string' && parsed.stage_id !== '') {
      if (ids.has(parsed.stage_id)) issues.push(PA_PROFILE_SHEET + '!A' + sheetRow + ': stage_id가 ' + ids.get(parsed.stage_id) + '행과 중복됩니다.');
      else ids.set(parsed.stage_id, sheetRow);
    }
    if (Number.isInteger(parsed.stage_order)) {
      if (orders.has(parsed.stage_order)) issues.push(PA_PROFILE_SHEET + '!B' + sheetRow + ': stage_order가 ' + orders.get(parsed.stage_order) + '행과 중복됩니다.');
      else orders.set(parsed.stage_order, sheetRow);
    }

    paValidateCrossFields_(parsed, sheetRow, issues);
    profiles.push(paToRuntimeProfile_(parsed));
  });

  if (profileCount === 0) issues.push(PA_PROFILE_SHEET + '!A2:T: 스테이지가 하나 이상 필요합니다.');
  paValidateUnexpectedColumns_(profileSheet, issues);
  profiles.sort((left, right) => left.stage_order - right.stage_order || left.stage_id.localeCompare(right.stage_id));
  return { isValid: issues.length === 0, issues: issues, profileCount: profileCount, profiles: profiles };
}

function paSnapshotFromValidation_(result) {
  if (!result.isValid) throw new Error(result.issues.join('\n'));
  const hashInput = { schema_version: PA_SCHEMA_VERSION, profiles: result.profiles };
  const contentHash = paSha256_(paCanonicalJson_(hashInput));
  return {
    schema_version: PA_SCHEMA_VERSION,
    source_revision: 'sheets-v2:' + contentHash.slice(0, 12),
    content_hash: contentHash,
    profiles: result.profiles,
  };
}

function paPublishSnapshot_(snapshot) {
  paValidatePublishedSnapshot_(snapshot);
  const json = JSON.stringify(snapshot);
  const encoded = Utilities.base64Encode(json, Utilities.Charset.UTF_8);
  if (encoded.length > PA_PUBLISHED_PAYLOAD_LIMIT) {
    throw new Error('게시 데이터가 Apps Script 저장 한도인 ' + PA_PUBLISHED_PAYLOAD_LIMIT + '자를 초과합니다.');
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new Error('다른 게시 작업이 실행 중입니다. 잠시 후 다시 시도하세요.');
  const store = PropertiesService.getScriptProperties();
  const previous = paPublishedProperties_(store.getProperties());
  try {
    paClearPublishedProperties_(store);
    const chunkCount = Math.ceil(encoded.length / PA_PUBLISHED_CHUNK_SIZE);
    const chunks = {};
    for (let index = 0; index < chunkCount; index += 1) {
      chunks[paPublishedChunkKey_(index)] = encoded.slice(
        index * PA_PUBLISHED_CHUNK_SIZE,
        (index + 1) * PA_PUBLISHED_CHUNK_SIZE,
      );
    }
    store.setProperties(chunks, false);
    store.setProperty(PA_PUBLISHED_MANIFEST, JSON.stringify({
      chunk_count: chunkCount,
      encoded_length: encoded.length,
      content_hash: snapshot.content_hash,
      source_revision: snapshot.source_revision,
    }));
  } catch (error) {
    paClearPublishedProperties_(store);
    if (Object.keys(previous).length > 0) store.setProperties(previous, false);
    throw error;
  } finally {
    lock.releaseLock();
  }
}

function paLoadPublishedSnapshot_() {
  const store = PropertiesService.getScriptProperties();
  const rawManifest = store.getProperty(PA_PUBLISHED_MANIFEST);
  if (!rawManifest) throw new Error('게시된 밸런스 데이터가 없습니다. 시트 메뉴에서 데이터 검증을 실행하세요.');
  const manifest = JSON.parse(rawManifest);
  if (!Number.isInteger(manifest.chunk_count) || manifest.chunk_count < 1) throw new Error('게시 manifest가 손상되었습니다.');
  let encoded = '';
  for (let index = 0; index < manifest.chunk_count; index += 1) {
    const chunk = store.getProperty(paPublishedChunkKey_(index));
    if (chunk === null) throw new Error('게시 데이터 chunk ' + index + '가 없습니다.');
    encoded += chunk;
  }
  if (encoded.length !== manifest.encoded_length) throw new Error('게시 데이터 길이가 manifest와 다릅니다.');
  const json = Utilities.newBlob(Utilities.base64Decode(encoded)).getDataAsString('UTF-8');
  const snapshot = JSON.parse(json);
  paValidatePublishedSnapshot_(snapshot);
  if (snapshot.content_hash !== manifest.content_hash || snapshot.source_revision !== manifest.source_revision) {
    throw new Error('게시 데이터 식별자가 manifest와 다릅니다.');
  }
  return snapshot;
}

function paValidatePublishedSnapshot_(snapshot) {
  if (!snapshot || snapshot.schema_version !== PA_SCHEMA_VERSION || !Array.isArray(snapshot.profiles)) {
    throw new Error('게시 snapshot 구조가 올바르지 않습니다.');
  }
  const expectedHash = paSha256_(paCanonicalJson_({
    schema_version: snapshot.schema_version,
    profiles: snapshot.profiles,
  }));
  if (snapshot.content_hash !== expectedHash) throw new Error('게시 snapshot content_hash가 일치하지 않습니다.');
  if (snapshot.source_revision !== 'sheets-v2:' + expectedHash.slice(0, 12)) {
    throw new Error('게시 snapshot source_revision이 일치하지 않습니다.');
  }
}

function paPublishedProperties_(properties) {
  const selected = {};
  Object.keys(properties).forEach((key) => {
    if (key.indexOf(PA_PUBLISHED_PREFIX) === 0) selected[key] = properties[key];
  });
  return selected;
}

function paClearPublishedProperties_(store) {
  Object.keys(store.getProperties()).forEach((key) => {
    if (key.indexOf(PA_PUBLISHED_PREFIX) === 0) store.deleteProperty(key);
  });
}

function paPublishedChunkKey_(index) {
  return PA_PUBLISHED_PREFIX + 'chunk_' + String(index).padStart(3, '0');
}

function paJsonOutput_(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}

function paValidateFixedTable_(sheet, expected, sheetName, issues) {
  if (!sheet) {
    issues.push(sheetName + '!A1: 필수 탭이 없습니다.');
    return;
  }
  const actual = sheet.getRange(1, 1, expected.length, expected[0].length).getValues();
  expected.forEach((row, rowIndex) => {
    row.forEach((value, columnIndex) => {
      if (String(actual[rowIndex][columnIndex]) !== String(value)) {
        issues.push(sheetName + '!' + paColumnName_(columnIndex + 1) + (rowIndex + 1) + ': 표준 값과 다릅니다.');
      }
    });
  });
}

function paValidateHeader_(sheet, expected, sheetName, issues) {
  if (!sheet) {
    issues.push(sheetName + '!A1: 필수 탭이 없습니다.');
    return;
  }
  const actual = sheet.getRange(1, 1, 1, expected.length).getValues()[0];
  expected.forEach((value, index) => {
    if (actual[index] !== value) {
      issues.push(sheetName + '!' + paColumnName_(index + 1) + '1: 헤더는 ' + value + '이어야 합니다.');
    }
  });
}

function paParseField_(value, field, address, issues) {
  if (paIsBlank_(value)) {
    if (field.required) issues.push(address + ': ' + field.id + ' 값이 필요합니다.');
    return null;
  }
  if (field.type === 'string') {
    const parsed = String(value).trim();
    if (field.allowedValues && !field.allowedValues.includes(parsed)) {
      issues.push(address + ': ' + field.allowedValues.join(' 또는 ') + ' 중 하나를 입력해야 합니다.');
    }
    return parsed;
  }

  const parsed = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(parsed)) {
    issues.push(address + ': 숫자를 입력해야 합니다.');
    return null;
  }
  if (field.type === 'int' && !Number.isInteger(parsed)) issues.push(address + ': 정수를 입력해야 합니다.');
  if (field.min !== undefined && parsed < field.min) issues.push(address + ': 최솟값은 ' + field.min + '입니다.');
  if (field.max !== undefined && parsed > field.max) issues.push(address + ': 최댓값은 ' + field.max + '입니다.');
  return parsed;
}

function paValidateCrossFields_(profile, row, issues) {
  const address = (column) => PA_PROFILE_SHEET + '!' + column + row;
  const cellCount = profile.grid_width * profile.grid_height;
  if (Number.isFinite(cellCount) && cellCount > 10000) {
    issues.push(address('D') + ':' + address('E') + ': 전체 셀 수는 10000을 넘을 수 없습니다.');
  }

  [
    ['primary_arrow_count', 'H'],
    ['min_length', 'I'],
    ['max_length', 'J'],
    ['filler_max_length', 'L'],
  ].forEach((item) => {
    if (Number.isFinite(profile[item[0]]) && Number.isFinite(cellCount) && profile[item[0]] > cellCount) {
      issues.push(address(item[1]) + ': 전체 셀 수 ' + cellCount + '을 넘을 수 없습니다.');
    }
  });

  [
    ['min_length', 'max_length', 'J'],
    ['min_dependency_depth', 'max_dependency_depth', 'N'],
    ['min_initial_extractable_ratio', 'max_initial_extractable_ratio', 'P'],
    ['min_forced_state_ratio', 'max_forced_state_ratio', 'R'],
  ].forEach((item) => {
    if (Number.isFinite(profile[item[0]]) && Number.isFinite(profile[item[1]]) && profile[item[1]] < profile[item[0]]) {
      issues.push(address(item[2]) + ': ' + item[1] + '은 ' + item[0] + ' 이상이어야 합니다.');
    }
  });
}

function paToRuntimeProfile_(row) {
  return {
    stage_id: row.stage_id,
    stage_order: row.stage_order,
    expected_difficulty_level: row.expected_difficulty_level,
    grid_size: [row.grid_width, row.grid_height],
    seed: row.seed,
    generation_mode: row.generation_mode,
    primary_arrow_count: row.primary_arrow_count,
    min_length: row.min_length,
    max_length: row.max_length,
    target_empty_ratio: row.target_empty_ratio,
    filler_max_length: row.filler_max_length,
    dependency_target: {
      min_dependency_depth: row.min_dependency_depth,
      max_dependency_depth: row.max_dependency_depth,
      min_initial_extractable_ratio: row.min_initial_extractable_ratio,
      max_initial_extractable_ratio: row.max_initial_extractable_ratio,
      min_forced_state_ratio: row.min_forced_state_ratio,
      max_forced_state_ratio: row.max_forced_state_ratio,
    },
    max_candidate_attempts: row.max_candidate_attempts,
  };
}

function paCanonicalJson_(value) {
  if (Array.isArray(value)) return '[' + value.map(paCanonicalJson_).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map((key) => (
      JSON.stringify(key) + ':' + paCanonicalJson_(value[key])
    )).join(',') + '}';
  }
  return JSON.stringify(value);
}

function paSha256_(value) {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    value,
    Utilities.Charset.UTF_8,
  );
  return digest.map((byte) => ((byte + 256) % 256).toString(16).padStart(2, '0')).join('');
}

function paValidateUnexpectedColumns_(sheet, issues) {
  const lastColumn = sheet.getLastColumn();
  const lastRow = Math.max(sheet.getLastRow(), 1);
  if (lastColumn <= PA_PROFILE_COLUMNS.length) return;
  const values = sheet.getRange(1, PA_PROFILE_COLUMNS.length + 1, lastRow, lastColumn - PA_PROFILE_COLUMNS.length).getValues();
  values.forEach((row, rowIndex) => {
    row.forEach((value, columnIndex) => {
      if (!paIsBlank_(value)) {
        issues.push(PA_PROFILE_SHEET + '!' + paColumnName_(PA_PROFILE_COLUMNS.length + columnIndex + 1) + (rowIndex + 1) + ': 표준 범위 밖의 값입니다.');
      }
    });
  });
}

function paIsBlank_(value) {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
}

function paIsBlankRow_(row) {
  return row.every(paIsBlank_);
}

function paColumnName_(index) {
  let name = '';
  for (let current = index; current > 0; current = Math.floor((current - 1) / 26)) {
    name = String.fromCharCode(65 + ((current - 1) % 26)) + name;
  }
  return name;
}
