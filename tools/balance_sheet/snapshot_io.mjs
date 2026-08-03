import { mkdir, open, rename, rm } from "node:fs/promises";
import { dirname } from "node:path";

import { validateSnapshot } from "./schema.mjs";

export async function writeSnapshotAtomic(outputPath, snapshot) {
	validateSnapshot(snapshot);
	await mkdir(dirname(outputPath), { recursive: true });
	const temporaryPath = `${outputPath}.tmp-${process.pid}`;
	let handle;
	try {
		handle = await open(temporaryPath, "wx");
		await handle.writeFile(`${JSON.stringify(snapshot, null, "\t")}\n`, "utf8");
		await handle.sync();
		await handle.close();
		handle = undefined;
		await rename(temporaryPath, outputPath);
	} catch (error) {
		if (handle) await handle.close();
		await rm(temporaryPath, { force: true });
		throw error;
	}
}
