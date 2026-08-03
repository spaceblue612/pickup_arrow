import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { runCli } from "../cli.mjs";
import { normalizeSheetValues, standardSheetValues } from "../schema.mjs";

function publishedSnapshot() {
	const snapshot = normalizeSheetValues(standardSheetValues());
	snapshot.source_revision = `sheets-v${snapshot.schema_version}:${snapshot.content_hash.slice(0, 12)}`;
	return snapshot;
}

function response(body, { ok = true, status = 200 } = {}) {
	return { ok, status, text: async () => typeof body === "string" ? body : JSON.stringify(body) };
}

test("sync follows redirects, validates the published snapshot, and writes it atomically", async () => {
	const directory = await mkdtemp(join(tmpdir(), "pickup-arrow-apps-script-"));
	const output = join(directory, "snapshot.json");
	const snapshot = publishedSnapshot();
	let capturedUrl = "";
	let capturedOptions;
	try {
		const result = await runCli(["sync", "--output", output], {
			PICKUP_ARROW_SHEETS_URL: "https://script.google.com/macros/s/deployment/exec",
		}, {
			signal: null,
			fetchImpl: async (url, options) => {
				capturedUrl = url;
				capturedOptions = options;
				return response(snapshot);
			},
		});
		assert.equal(capturedUrl, "https://script.google.com/macros/s/deployment/exec");
		assert.equal(capturedOptions.redirect, "follow");
		assert.equal(capturedOptions.headers.accept, "application/json");
		assert.deepEqual(result, snapshot);
		assert.deepEqual(JSON.parse(await readFile(output, "utf8")), snapshot);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});

test("sync failures preserve the last-known-good snapshot", async () => {
	const directory = await mkdtemp(join(tmpdir(), "pickup-arrow-apps-script-failure-"));
	const output = join(directory, "snapshot.json");
	await writeFile(output, "LAST-KNOWN-GOOD\n", "utf8");
	const endpoint = { PICKUP_ARROW_SHEETS_URL: "https://script.google.com/macros/s/deployment/exec" };
	const cases = [
		[response("denied", { ok: false, status: 403 }), /403/],
		[response("not json"), /invalid JSON/],
		[response({ ok: false, error: "sheet invalid" }), /sheet invalid/],
		[response({ ...publishedSnapshot(), content_hash: "bad" }), /content_hash/],
		[response({ ...publishedSnapshot(), source_revision: "wrong" }), /source_revision/],
	];
	try {
		for (const [fixtureResponse, expectedError] of cases) {
			await assert.rejects(() => runCli(["sync", "--output", output], endpoint, {
				signal: null,
				fetchImpl: async () => fixtureResponse,
			}), expectedError);
			assert.equal(await readFile(output, "utf8"), "LAST-KNOWN-GOOD\n");
		}
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});

test("sync accepts only an explicit credential-free HTTP endpoint", async () => {
	await assert.rejects(() => runCli(["sync"], {}, {}), /PICKUP_ARROW_SHEETS_URL is required/);
	await assert.rejects(() => runCli(["sync"], { PICKUP_ARROW_SHEETS_URL: "file:///tmp/data.json" }, {}), /http or https/);
	await assert.rejects(() => runCli(["sync"], { PICKUP_ARROW_SHEETS_URL: "https://user:secret@example.test/exec" }, {}), /must not contain credentials/);
	await assert.rejects(() => runCli(["setup"], { PICKUP_ARROW_SHEETS_URL: "https://example.test" }, {}), /Usage/);
});
