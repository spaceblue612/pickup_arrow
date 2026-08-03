import assert from "node:assert/strict";
import test from "node:test";

import {
	BalanceValidationError,
	INITIAL_PROFILE_ROWS,
	PROFILE_SHEET,
	applyColumnMigration,
	normalizeSheetValues,
	standardSheetValues,
	validateSnapshot,
} from "../schema.mjs";

test("schema normalizes the four bootstrap stages and generation modes deterministically", () => {
	const first = normalizeSheetValues(standardSheetValues(), { sourceRevision: "fixture" });
	const second = normalizeSheetValues(standardSheetValues(), { sourceRevision: "fixture" });
	assert.deepEqual(first, second);
	assert.deepEqual(first.profiles.map((profile) => profile.stage_id), ["STAGE-001", "STAGE-002", "STAGE-003", "STAGE-004"]);
	assert.deepEqual(first.profiles.map((profile) => profile.generation_mode), ["fixed", "fixed", "fixed", "random"]);
	assert.equal(first.profiles[0].expected_difficulty_level, null);
	assert.equal(first.profiles[2].dependency_target.max_forced_state_ratio, 1);
	assert.equal(first.content_hash.length, 64);
	assert.ok(standardSheetValues().metric_guide.some((row) => row[1] === "observed"));
	assert.ok(standardSheetValues().metric_guide.some((row) => row[1] === "deferred"));
	assert.equal(validateSnapshot(first), first);
});

test("schema reports formulas, partial rows, duplicate IDs, and cross-field errors with cells", () => {
	const values = standardSheetValues();
	values[PROFILE_SHEET].push(["STAGE-001", 4, "", 200, 100, "=1+2", "fixed", 1, 5, 2]);
	assert.throws(
		() => normalizeSheetValues(values),
		(error) => {
			assert.ok(error instanceof BalanceValidationError);
			assert.match(error.message, /stage_profiles!F6 \(seed\): formulas are not allowed/);
			assert.match(error.message, /duplicate stage_id/);
			assert.match(error.message, /grid cell count must not exceed 10000/);
			assert.match(error.message, /max_length.*must be at least min_length/);
			assert.match(error.message, /value is required/);
			return true;
		},
	);
});

test("blank rows are ignored and stage_order owns normalized progression", () => {
	const values = standardSheetValues();
	values[PROFILE_SHEET] = [values[PROFILE_SHEET][0], INITIAL_PROFILE_ROWS[3], INITIAL_PROFILE_ROWS[2], [], INITIAL_PROFILE_ROWS[0], INITIAL_PROFILE_ROWS[1]];
	const snapshot = normalizeSheetValues(values);
	assert.deepEqual(snapshot.profiles.map((profile) => profile.stage_id), ["STAGE-001", "STAGE-002", "STAGE-003", "STAGE-004"]);
});

test("schema rejects unsupported generation modes", () => {
	const values = standardSheetValues();
	values[PROFILE_SHEET][1][6] = "sometimes";
	assert.throws(() => normalizeSheetValues(values), /generation_mode.*expected one of fixed, random/);
});

test("column migration supports rename, remove, and add without mutating the source", () => {
	const source = [["old", "remove"], ["value", "legacy"]];
	const migrated = applyColumnMigration(source, {
		renames: [{ from: "old", to: "renamed" }],
		removes: ["remove"],
		adds: [{ field: "added", index: 1, default: 64 }],
	});
	assert.deepEqual(migrated, [["renamed", "added"], ["value", 64]]);
	assert.deepEqual(source, [["old", "remove"], ["value", "legacy"]]);
});
