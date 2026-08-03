import { createHash } from "node:crypto";

export const SCHEMA_VERSION = 2;
export const PROJECT_ID = "pickup-arrow";
export const META_SHEET = "_meta";
export const PROFILE_SHEET = "stage_profiles";
export const GUIDE_SHEET = "metric_guide";

export const PROFILE_COLUMNS = Object.freeze([
	"stage_id",
	"stage_order",
	"expected_difficulty_level",
	"grid_width",
	"grid_height",
	"seed",
	"generation_mode",
	"primary_arrow_count",
	"min_length",
	"max_length",
	"target_empty_ratio",
	"filler_max_length",
	"min_dependency_depth",
	"max_dependency_depth",
	"min_initial_extractable_ratio",
	"max_initial_extractable_ratio",
	"min_forced_state_ratio",
	"max_forced_state_ratio",
	"max_candidate_attempts",
	"operator_note",
]);

export const GUIDE_COLUMNS = Object.freeze([
	"metric_id",
	"classification",
	"group",
	"value_type",
	"required",
	"allowed_range",
	"default_value",
	"stage_profiles_column",
	"description",
]);

export const META_ROWS = Object.freeze([
	["key", "value", "description"],
	["schema_version", SCHEMA_VERSION, "Balance sheet schema version"],
	["project_id", PROJECT_ID, "Owning project"],
	["profile_sheet", PROFILE_SHEET, "Operational stage profile source"],
	["metric_guide_sheet", GUIDE_SHEET, "Metric definitions"],
]);

const FIELD_SPECS = Object.freeze({
	stage_id: { type: "string", required: true, group: "identity", range: "unique stable ID", description: "Stable stage identifier" },
	stage_order: { type: "int", required: true, min: 1, group: "identity", range: ">= 1, unique", description: "Progression order" },
	expected_difficulty_level: { type: "int", required: false, min: 1, max: 100, group: "difficulty", range: "blank or 1..100", description: "Operator-calibrated expected difficulty" },
	grid_width: { type: "int", required: true, min: 1, max: 999, group: "board", range: "1..999", description: "Board width" },
	grid_height: { type: "int", required: true, min: 1, max: 999, group: "board", range: "1..999; width x height <= 10000", description: "Board height" },
	seed: { type: "int", required: true, min: 0, max: 2147483647, group: "generation", range: "0..2147483647", description: "Deterministic base seed" },
	generation_mode: { type: "string", required: true, values: ["fixed", "random"], group: "generation", range: "fixed or random", description: "Map generation lifecycle" },
	primary_arrow_count: { type: "int", required: true, min: 1, group: "generation", range: "1..playable cell count", description: "Primary arrow count" },
	min_length: { type: "int", required: true, min: 1, group: "generation", range: "1..playable cell count", description: "Minimum primary arrow length" },
	max_length: { type: "int", required: true, min: 1, group: "generation", range: "min_length..playable cell count", description: "Maximum primary arrow length" },
	target_empty_ratio: { type: "float", required: true, min: 0, max: 1, group: "generation", range: "0.0..1.0", description: "Target empty-cell ratio" },
	filler_max_length: { type: "int", required: true, min: 1, group: "generation", range: "1..playable cell count", description: "Maximum filler arrow length" },
	min_dependency_depth: { type: "int", required: true, min: 1, group: "dependency", range: ">= 1", description: "Minimum dependency depth" },
	max_dependency_depth: { type: "int", required: true, min: 1, group: "dependency", range: ">= minimum", description: "Maximum dependency depth" },
	min_initial_extractable_ratio: { type: "float", required: true, min: 0, max: 1, group: "dependency", range: "0.0..1.0", description: "Minimum initial extractable ratio" },
	max_initial_extractable_ratio: { type: "float", required: true, min: 0, max: 1, group: "dependency", range: "minimum..1.0", description: "Maximum initial extractable ratio" },
	min_forced_state_ratio: { type: "float", required: true, min: 0, max: 1, group: "dependency", range: "0.0..1.0", description: "채택에는 사용하지 않는 강제 진행 비율 참고 범위의 최솟값" },
	max_forced_state_ratio: { type: "float", required: true, min: 0, max: 1, group: "dependency", range: "minimum..1.0", description: "채택에는 사용하지 않는 강제 진행 비율 참고 범위의 최댓값" },
	max_candidate_attempts: { type: "int", required: true, min: 1, max: 256, default: 64, group: "budget", range: "1..256", description: "Maximum candidate attempts" },
	operator_note: { type: "string", required: false, group: "operations", range: "free text", description: "Operator note; excluded from runtime snapshot" },
});

export const INITIAL_PROFILE_ROWS = Object.freeze([
	["STAGE-001", 1, "", 9, 9, 1001, "fixed", 3, 1, 6, 0.70, 3, 2, 4, 0.50, 1.00, 0.00, 0.25, 64, ""],
	["STAGE-002", 2, "", 9, 9, 2002, "fixed", 4, 3, 10, 0.55, 3, 3, 5, 0.30, 0.60, 0.10, 0.40, 64, ""],
	["STAGE-003", 3, "", 9, 9, 3003, "fixed", 5, 5, 14, 0.40, 3, 4, 8, 0.00, 0.40, 0.20, 1.00, 64, ""],
	["STAGE-004", 4, "", 9, 9, 4004, "random", 5, 5, 14, 0.40, 3, 4, 8, 0.00, 0.40, 0.20, 1.00, 64, ""],
]);

const OBSERVED_METRICS = Object.freeze([
	["node_count", "generation", "int", ">= 1", "Generated arrow count"],
	["filler_arrow_count", "generation", "int", ">= 0", "Generated filler arrow count"],
	["occupied_cell_count", "generation", "int", ">= 1", "Occupied playable cells"],
	["actual_empty_ratio", "generation", "float", "0.0..1.0", "Measured empty-cell ratio"],
	["edge_count", "dependency", "int", ">= 0", "Dependency graph edge count"],
	["dependency_depth", "dependency", "int", ">= 0", "Measured dependency depth"],
	["initial_extractable_count", "dependency", "int", ">= 0", "Initially extractable arrows"],
	["initial_extractable_ratio", "dependency", "float", "0.0..1.0", "Measured initial extractable ratio"],
	["forced_state_count", "dependency", "int", ">= 0", "Solution states with one choice"],
	["forced_state_ratio", "dependency", "float", "0.0..1.0", "Measured forced-state ratio"],
	["average_choice_count", "dependency", "float", ">= 0.0", "Average choices across solution states"],
	["choice_counts", "dependency", "int_array", "each >= 0", "Choice count at each solution state"],
	["attempt_count", "budget", "int", "1..max_candidate_attempts", "Candidate attempts used"],
	["selected_seed", "generation", "int", "0..2147483647+", "Selected deterministic candidate seed"],
	["has_complete_solution", "dependency", "bool", "true or false", "Whether analysis found a complete solution"],
]);

const DEFERRED_METRICS = Object.freeze([
	["adoption_target_metrics", "generation", "future", "deferred", "New candidate acceptance targets such as total arrows and average choices"],
	["shape_visual_metrics", "shape", "future", "deferred", "Length variance, bends, direction bias, and local density"],
	["advanced_dependency_metrics", "dependency", "future", "deferred", "Fan-in, fan-out, density, components, modules, and gates"],
	["play_constraint_metrics", "play", "future", "deferred", "Time, mistake, hint, and tempo constraints"],
]);

const CONFIGURABLE_GUIDE_ROWS = PROFILE_COLUMNS.map((field) => {
	const spec = FIELD_SPECS[field];
	return [
		field,
		field === "operator_note" ? "configurable" : "configurable",
		spec.group,
		spec.type,
		spec.required,
		spec.range,
		spec.default ?? "",
		field,
		spec.description,
	];
});

export const METRIC_GUIDE_ROWS = Object.freeze([
	...CONFIGURABLE_GUIDE_ROWS,
	...OBSERVED_METRICS.map(([id, group, type, range, description]) => [id, "observed", group, type, false, range, "", "", description]),
	...DEFERRED_METRICS.map(([id, group, type, range, description]) => [id, "deferred", group, type, false, range, "", "", description]),
]);

export class BalanceValidationError extends Error {
	constructor(issues) {
		super(issues.join("\n"));
		this.name = "BalanceValidationError";
		this.issues = issues;
	}
}

export function standardSheetValues() {
	return {
		[META_SHEET]: META_ROWS.map((row) => [...row]),
		[PROFILE_SHEET]: [[...PROFILE_COLUMNS], ...INITIAL_PROFILE_ROWS.map((row) => [...row])],
		[GUIDE_SHEET]: [[...GUIDE_COLUMNS], ...METRIC_GUIDE_ROWS.map((row) => [...row])],
	};
}

export function normalizeSheetValues(sheetValues, { sourceRevision = "local" } = {}) {
	const issues = [];
	validateFixedTable(sheetValues[META_SHEET], META_ROWS, META_SHEET, issues);
	validateHeader(sheetValues[PROFILE_SHEET]?.[0], PROFILE_COLUMNS, PROFILE_SHEET, issues);
	validateHeader(sheetValues[GUIDE_SHEET]?.[0], GUIDE_COLUMNS, GUIDE_SHEET, issues);
	validateGuide(sheetValues[GUIDE_SHEET], issues);

	const profiles = [];
	const ids = new Map();
	const orders = new Map();
	for (let rowIndex = 1; rowIndex < (sheetValues[PROFILE_SHEET]?.length ?? 0); rowIndex += 1) {
		const rawRow = sheetValues[PROFILE_SHEET][rowIndex] ?? [];
		if (isBlankRow(rawRow)) continue;
		if (rawRow.length > PROFILE_COLUMNS.length && rawRow.slice(PROFILE_COLUMNS.length).some((value) => !isBlank(value))) {
			issues.push(`${PROFILE_SHEET}!U${rowIndex + 1}: unexpected column outside the 20-field schema`);
		}
		const values = Object.fromEntries(PROFILE_COLUMNS.map((field, index) => [field, rawRow[index] ?? ""]));
		const parsed = {};
		for (let columnIndex = 0; columnIndex < PROFILE_COLUMNS.length; columnIndex += 1) {
			const field = PROFILE_COLUMNS[columnIndex];
			const address = `${PROFILE_SHEET}!${columnName(columnIndex + 1)}${rowIndex + 1}`;
			parsed[field] = parseField(values[field], field, FIELD_SPECS[field], address, issues);
		}
		validateProfileCrossFields(parsed, rowIndex + 1, issues);
		if (typeof parsed.stage_id === "string" && parsed.stage_id.length > 0) {
			if (ids.has(parsed.stage_id)) issues.push(`${PROFILE_SHEET}!A${rowIndex + 1}: duplicate stage_id also used at row ${ids.get(parsed.stage_id)}`);
			else ids.set(parsed.stage_id, rowIndex + 1);
		}
		if (Number.isInteger(parsed.stage_order)) {
			if (orders.has(parsed.stage_order)) issues.push(`${PROFILE_SHEET}!B${rowIndex + 1}: duplicate stage_order also used at row ${orders.get(parsed.stage_order)}`);
			else orders.set(parsed.stage_order, rowIndex + 1);
		}
		profiles.push(toRuntimeProfile(parsed));
	}
	if (profiles.length === 0) issues.push(`${PROFILE_SHEET}!A2:T: at least one stage profile is required`);
	if (issues.length > 0) throw new BalanceValidationError(issues);

	profiles.sort((left, right) => left.stage_order - right.stage_order || left.stage_id.localeCompare(right.stage_id));
	const hashInput = { schema_version: SCHEMA_VERSION, profiles };
	const contentHash = sha256(canonicalJson(hashInput));
	return {
		schema_version: SCHEMA_VERSION,
		source_revision: sourceRevision,
		content_hash: contentHash,
		profiles,
	};
}

export function validateSnapshot(snapshot) {
	const issues = [];
	if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) throw new BalanceValidationError(["Snapshot root must be an object"]);
	if (snapshot.schema_version !== SCHEMA_VERSION) issues.push(`schema_version must be ${SCHEMA_VERSION}`);
	if (typeof snapshot.source_revision !== "string" || snapshot.source_revision.length === 0) issues.push("source_revision must be a non-empty string");
	if (!Array.isArray(snapshot.profiles)) issues.push("profiles must be an array");
	if (issues.length > 0) throw new BalanceValidationError(issues);
	const expectedHash = sha256(canonicalJson({ schema_version: snapshot.schema_version, profiles: snapshot.profiles }));
	if (snapshot.content_hash !== expectedHash) throw new BalanceValidationError(["content_hash does not match canonical snapshot content"]);
	return snapshot;
}

export function canonicalJson(value) {
	if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
	if (value && typeof value === "object") {
		return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
	}
	return JSON.stringify(value);
}

export function applyColumnMigration(table, migration) {
	if (!Array.isArray(table) || !Array.isArray(table[0])) throw new Error("Migration table requires a header row");
	const header = [...table[0]];
	const rows = table.slice(1).map((row) => [...row]);
	for (const rename of migration.renames ?? []) {
		const index = header.indexOf(rename.from);
		if (index < 0 || header.includes(rename.to)) throw new Error(`Cannot rename ${rename.from} to ${rename.to}`);
		header[index] = rename.to;
	}
	for (const field of migration.removes ?? []) {
		const index = header.indexOf(field);
		if (index < 0) throw new Error(`Cannot remove missing field ${field}`);
		header.splice(index, 1);
		for (const row of rows) row.splice(index, 1);
	}
	for (const addition of migration.adds ?? []) {
		if (header.includes(addition.field)) throw new Error(`Cannot add existing field ${addition.field}`);
		const index = addition.index ?? header.length;
		if (!Number.isInteger(index) || index < 0 || index > header.length) throw new Error(`Invalid index for ${addition.field}`);
		header.splice(index, 0, addition.field);
		for (const row of rows) row.splice(index, 0, addition.default ?? "");
	}
	return [header, ...rows];
}

function validateFixedTable(actual, expected, sheet, issues) {
	if (!Array.isArray(actual)) {
		issues.push(`${sheet}!A1: required sheet is missing`);
		return;
	}
	for (let rowIndex = 0; rowIndex < expected.length; rowIndex += 1) {
		for (let columnIndex = 0; columnIndex < expected[rowIndex].length; columnIndex += 1) {
			if (String(actual[rowIndex]?.[columnIndex] ?? "") !== String(expected[rowIndex][columnIndex])) {
				issues.push(`${sheet}!${columnName(columnIndex + 1)}${rowIndex + 1}: expected ${JSON.stringify(expected[rowIndex][columnIndex])}`);
			}
		}
	}
}

function validateHeader(actual, expected, sheet, issues) {
	if (!Array.isArray(actual)) {
		issues.push(`${sheet}!A1: required header row is missing`);
		return;
	}
	if (actual.length !== expected.length) issues.push(`${sheet}!A1: expected exactly ${expected.length} columns`);
	for (let index = 0; index < expected.length; index += 1) {
		if (actual[index] !== expected[index]) issues.push(`${sheet}!${columnName(index + 1)}1: expected header ${expected[index]}`);
	}
}

function validateGuide(table, issues) {
	if (!Array.isArray(table)) return;
	const expected = METRIC_GUIDE_ROWS;
	if (table.length !== expected.length + 1) issues.push(`${GUIDE_SHEET}!A2:I: expected exactly ${expected.length} metric rows`);
	for (let rowIndex = 0; rowIndex < expected.length; rowIndex += 1) {
		for (let columnIndex = 0; columnIndex < GUIDE_COLUMNS.length; columnIndex += 1) {
			if (String(table[rowIndex + 1]?.[columnIndex] ?? "") !== String(expected[rowIndex][columnIndex])) {
				issues.push(`${GUIDE_SHEET}!${columnName(columnIndex + 1)}${rowIndex + 2}: schema guide value differs from version ${SCHEMA_VERSION}`);
			}
		}
	}
}

function parseField(value, field, spec, address, issues) {
	if (typeof value === "string" && value.trimStart().startsWith("=")) {
		issues.push(`${address} (${field}): formulas are not allowed`);
		return null;
	}
	if (isBlank(value)) {
		if (spec.required) issues.push(`${address} (${field}): value is required`);
		return spec.required ? null : null;
	}
	if (spec.type === "string") {
		if (typeof value !== "string") issues.push(`${address} (${field}): expected text`);
		const parsed = String(value).trim();
		if (spec.values && !spec.values.includes(parsed)) issues.push(`${address} (${field}): expected one of ${spec.values.join(", ")}`);
		return parsed;
	}
	const parsed = typeof value === "number" ? value : Number(String(value).trim());
	if (!Number.isFinite(parsed)) {
		issues.push(`${address} (${field}): expected ${spec.type}`);
		return null;
	}
	if (spec.type === "int" && !Number.isInteger(parsed)) issues.push(`${address} (${field}): expected an integer`);
	if (spec.min !== undefined && parsed < spec.min) issues.push(`${address} (${field}): must be at least ${spec.min}`);
	if (spec.max !== undefined && parsed > spec.max) issues.push(`${address} (${field}): must be at most ${spec.max}`);
	return parsed;
}

function validateProfileCrossFields(profile, row, issues) {
	const address = (column) => `${PROFILE_SHEET}!${column}${row}`;
	if (Number.isInteger(profile.grid_width) && Number.isInteger(profile.grid_height) && profile.grid_width * profile.grid_height > 10000) {
		issues.push(`${address("D")}:${address("E")}: grid cell count must not exceed 10000`);
	}
	const cellCount = profile.grid_width * profile.grid_height;
	for (const [field, column] of [["primary_arrow_count", "H"], ["min_length", "I"], ["max_length", "J"], ["filler_max_length", "L"]]) {
		if (Number.isFinite(profile[field]) && Number.isFinite(cellCount) && profile[field] > cellCount) issues.push(`${address(column)} (${field}): must not exceed playable cell count ${cellCount}`);
	}
	for (const [minimum, maximum, column] of [
		["min_length", "max_length", "J"],
		["min_dependency_depth", "max_dependency_depth", "N"],
		["min_initial_extractable_ratio", "max_initial_extractable_ratio", "P"],
		["min_forced_state_ratio", "max_forced_state_ratio", "R"],
	]) {
		if (Number.isFinite(profile[minimum]) && Number.isFinite(profile[maximum]) && profile[maximum] < profile[minimum]) issues.push(`${address(column)} (${maximum}): must be at least ${minimum}`);
	}
}

function toRuntimeProfile(row) {
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

function isBlank(value) {
	return value === undefined || value === null || (typeof value === "string" && value.trim() === "");
}

function isBlankRow(row) {
	return row.every(isBlank);
}

function columnName(index) {
	let name = "";
	for (let current = index; current > 0; current = Math.floor((current - 1) / 26)) name = String.fromCharCode(65 + ((current - 1) % 26)) + name;
	return name;
}

function sha256(value) {
	return createHash("sha256").update(value).digest("hex");
}
