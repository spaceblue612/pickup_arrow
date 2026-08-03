#!/usr/bin/env node
import { resolve } from "node:path";

import { validateSnapshot } from "./schema.mjs";
import { writeSnapshotAtomic } from "./snapshot_io.mjs";

const DEFAULT_TIMEOUT_MS = 15000;

export async function runCli(argv, environment = process.env, dependencies = {}) {
	const command = argv[0];
	if (command !== "sync") throw new Error("Usage: node tools/balance_sheet/cli.mjs sync [--output path]");

	const endpointUrl = validateEndpointUrl(environment.PICKUP_ARROW_SHEETS_URL);
	const outputPath = resolve(option(argv, "--output") ?? "data/stage_balance.json");
	const fetchImpl = dependencies.fetchImpl ?? globalThis.fetch;
	if (typeof fetchImpl !== "function") throw new Error("This Node.js runtime does not provide fetch");

	console.error("[fetching] reading the published Apps Script balance snapshot");
	const response = await fetchImpl(endpointUrl, {
		method: "GET",
		redirect: "follow",
		headers: { accept: "application/json" },
		signal: dependencies.signal ?? AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
	});
	const body = await response.text();
	if (!response.ok) throw new Error(`Apps Script sync failed (${response.status}): ${body.slice(0, 300)}`);

	let snapshot;
	try {
		snapshot = JSON.parse(body);
	} catch (error) {
		throw new Error(`Apps Script returned invalid JSON: ${error.message}`);
	}
	if (snapshot?.ok === false) throw new Error(`Apps Script rejected sync: ${snapshot.error ?? "unknown error"}`);

	validateSnapshot(snapshot);
	const expectedRevision = `sheets-v${snapshot.schema_version}:${snapshot.content_hash.slice(0, 12)}`;
	if (snapshot.source_revision !== expectedRevision) {
		throw new Error(`source_revision must be ${expectedRevision}`);
	}
	await (dependencies.writeSnapshotAtomic ?? writeSnapshotAtomic)(outputPath, snapshot);
	console.error(`[ready] ${snapshot.profiles.length} stages synced to ${outputPath}; hash ${snapshot.content_hash}`);
	return snapshot;
}

function validateEndpointUrl(value) {
	if (!value) throw new Error("PICKUP_ARROW_SHEETS_URL is required");
	let url;
	try {
		url = new URL(value);
	} catch {
		throw new Error("PICKUP_ARROW_SHEETS_URL must be a valid URL");
	}
	if (!["https:", "http:"].includes(url.protocol)) throw new Error("PICKUP_ARROW_SHEETS_URL must use http or https");
	if (url.username || url.password) throw new Error("PICKUP_ARROW_SHEETS_URL must not contain credentials");
	return url.toString();
}

function option(argv, name) {
	const index = argv.indexOf(name);
	if (index < 0) return null;
	if (!argv[index + 1]) throw new Error(`${name} requires a value`);
	return argv[index + 1];
}

if (import.meta.url === `file://${process.argv[1]}`) {
	runCli(process.argv.slice(2)).catch((error) => {
		console.error(`[failed] ${error.message}`);
		process.exitCode = 1;
	});
}
