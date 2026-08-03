import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";

import { normalizeSheetValues, standardSheetValues } from "../schema.mjs";

const source = await readFile(new URL("../apps_script/Code.gs", import.meta.url), "utf8");

function appsScriptContext() {
	const properties = new Map();
	let failNextSet = false;
	const store = {
		getProperties: () => Object.fromEntries(properties),
		getProperty: (key) => properties.has(key) ? properties.get(key) : null,
		setProperty: (key, value) => {
			if (failNextSet) {
				failNextSet = false;
				throw new Error("fixture property failure");
			}
			properties.set(key, String(value));
		},
		setProperties: (values) => {
			if (failNextSet) {
				failNextSet = false;
				throw new Error("fixture property failure");
			}
			for (const [key, value] of Object.entries(values)) properties.set(key, String(value));
		},
		deleteProperty: (key) => properties.delete(key),
	};
	const lock = { held: false, tryLock() { this.held = true; return true; }, hasLock() { return this.held; }, releaseLock() { this.held = false; } };
	const context = vm.createContext({
		console,
		PropertiesService: { getScriptProperties: () => store },
		LockService: { getScriptLock: () => lock },
		Utilities: {
			Charset: { UTF_8: "UTF-8" },
			DigestAlgorithm: { SHA_256: "SHA_256" },
			computeDigest: (_algorithm, value) => [...createHash("sha256").update(value).digest()],
			base64Encode: (value) => Buffer.from(value, "utf8").toString("base64"),
			base64Decode: (value) => Buffer.from(value, "base64"),
			newBlob: (value) => ({ getDataAsString: () => Buffer.from(value).toString("utf8") }),
		},
		ContentService: {
			MimeType: { JSON: "application/json" },
			createTextOutput: (content) => ({ content, setMimeType() { return this; } }),
		},
	});
	vm.runInContext(source, context);
	return { context, properties, failNextPropertySet: () => { failNextSet = true; } };
}

test("Apps Script guide descriptions are Korean and snapshot hash matches the Node schema", () => {
	const { context } = appsScriptContext();
	const guideRows = context.paGuideRows_();
	assert.ok(guideRows.every((row) => /[가-힣]/.test(row[8])));

	const nodeSnapshot = normalizeSheetValues(standardSheetValues());
	const scriptSnapshot = context.paSnapshotFromValidation_({ isValid: true, profiles: nodeSnapshot.profiles });
	assert.equal(scriptSnapshot.content_hash, nodeSnapshot.content_hash);
	assert.equal(scriptSnapshot.source_revision, `sheets-v2:${nodeSnapshot.content_hash.slice(0, 12)}`);
	assert.deepEqual(JSON.parse(JSON.stringify(scriptSnapshot.profiles)), nodeSnapshot.profiles);
});

test("Apps Script migrates v1 profile values to fixed modes and adds random STAGE-004", () => {
	const { context } = appsScriptContext();
	const v2 = standardSheetValues().stage_profiles;
	const v1 = v2.slice(0, 4).map((row) => row.filter((_value, index) => index !== 6));
	v1[0].push("legacy_custom");
	v1[1].push("preserved in hidden backup");
	const migrated = JSON.parse(JSON.stringify(context.paMigrateV1ProfileValues_(v1)));
	assert.equal(migrated[0][6], "generation_mode");
	assert.equal(migrated[0].length, 20);
	assert.equal(migrated.flat().includes("preserved in hidden backup"), false);
	assert.deepEqual(migrated.slice(1).map((row) => row[6]), ["fixed", "fixed", "fixed", "random"]);
	assert.deepEqual(migrated.slice(1).map((row) => row[0]), ["STAGE-001", "STAGE-002", "STAGE-003", "STAGE-004"]);

	const partialV2 = v2.slice(0, 4).map((row) => [...row]);
	partialV2[1][6] = "";
	const recovered = JSON.parse(JSON.stringify(context.paMigrateV1ProfileValues_(partialV2)));
	assert.deepEqual(recovered.slice(1).map((row) => row[6]), ["fixed", "fixed", "fixed", "random"]);
	assert.deepEqual(recovered.slice(1).map((row) => row[0]), ["STAGE-001", "STAGE-002", "STAGE-003", "STAGE-004"]);
	assert.ok(source.indexOf("clearDataValidations()") < source.indexOf("profileSheet.clearContents()"));
});

test("Apps Script recovers an interrupted v2 table from the newest complete v1 backup", () => {
	const { context } = appsScriptContext();
	const v2 = standardSheetValues().stage_profiles;
	const v1 = v2.slice(0, 4).map((row) => row.filter((_value, index) => index !== 6));
	const interrupted = v2.slice(0, 4).map((row, rowIndex) => (
		rowIndex !== 1 ? [...row] : row.map((value, index) => index >= 7 && index <= 18 ? "" : value)
	));
	const partialBackup = interrupted.map((row) => [...row]);

	function fakeSheet(name, table) {
		return {
			getName: () => name,
			getLastRow: () => table.length,
			getLastColumn: () => Math.max(...table.map((row) => row.length)),
			getRange: (row, column, rowCount, columnCount) => ({
				getValues: () => Array.from({ length: rowCount }, (_unused, rowOffset) => (
					Array.from({ length: columnCount }, (_unusedColumn, columnOffset) => (
						table[row - 1 + rowOffset]?.[column - 1 + columnOffset] ?? ""
					))
				)),
			}),
		};
	}

	const active = fakeSheet("stage_profiles", interrupted);
	const completeBackup = fakeSheet("_backup_20260803010101001_stage_profiles", v1);
	const incompleteBackup = fakeSheet("_backup_20260803010101002_stage_profiles", partialBackup);
	const spreadsheet = {
		getSheetByName: (name) => name === "stage_profiles" ? active : null,
		getSheets: () => [active, completeBackup, incompleteBackup],
	};

	assert.equal(context.paMigrationTableIsRecoverable_(interrupted), false);
	assert.equal(context.paMigrationTableIsRecoverable_(v1), true);
	assert.equal(context.paHasInterruptedV1Migration_(spreadsheet), true);
	assert.equal(context.paFindV1MigrationSource_(spreadsheet, active).getName(), completeBackup.getName());
});

test("Apps Script publishes only the validated runtime snapshot and doGet returns it", () => {
	const { context } = appsScriptContext();
	const nodeSnapshot = normalizeSheetValues(standardSheetValues());
	const snapshot = context.paSnapshotFromValidation_({ isValid: true, profiles: nodeSnapshot.profiles });
	context.paPublishSnapshot_(snapshot);

	const expected = JSON.parse(JSON.stringify(snapshot));
	assert.deepEqual(JSON.parse(JSON.stringify(context.paLoadPublishedSnapshot_())), expected);
	assert.deepEqual(JSON.parse(context.doGet().content), expected);
	assert.equal(context.doGet().content.includes("operator_note"), false);
});

test("Apps Script reports corrupted publication and preserves the previous snapshot on write failure", () => {
	const { context, properties, failNextPropertySet } = appsScriptContext();
	const nodeSnapshot = normalizeSheetValues(standardSheetValues());
	const snapshot = context.paSnapshotFromValidation_({ isValid: true, profiles: nodeSnapshot.profiles });
	context.paPublishSnapshot_(snapshot);
	const before = Object.fromEntries(properties);

	failNextPropertySet();
	assert.throws(() => context.paPublishSnapshot_(snapshot), /fixture property failure/);
	assert.deepEqual(Object.fromEntries(properties), before);

	const chunkKey = [...properties.keys()].find((key) => key.includes("chunk_"));
	properties.set(chunkKey, "corrupted");
	const response = JSON.parse(context.doGet().content);
	assert.equal(response.ok, false);
	assert.match(response.error, /길이|JSON|snapshot|manifest/);
});

test("Apps Script refuses publication above its property payload guard", () => {
	const { context } = appsScriptContext();
	const nodeSnapshot = normalizeSheetValues(standardSheetValues());
	const oversizedProfiles = structuredClone(nodeSnapshot.profiles);
	oversizedProfiles[0].stage_id = "X".repeat(400000);
	const snapshot = context.paSnapshotFromValidation_({ isValid: true, profiles: oversizedProfiles });
	assert.throws(() => context.paPublishSnapshot_(snapshot), /450000/);
});
