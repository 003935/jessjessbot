import { $ } from 'bun';
import readline from 'node:readline';

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
});

async function awaitableQuestion(question: string): Promise<string> {
	return new Promise<string>((resolve) => {
		rl.question(question, resolve);
	});
}

async function main() {
	let dumpUrl: string | undefined = undefined;
	let restoreURl: string | undefined = undefined;
	let output: string;
	const fileName = 'dump.pgdump';

	dumpUrl = await awaitableQuestion('Database Url to Dump: ');

	restoreURl = await awaitableQuestion('Database Url to Restore: ');

	const dbdump = Bun.file(fileName);

	try {
		output = await $`pg_dump -Fc --no-owner --no-acl -d "${dumpUrl}" -f ${fileName}`.text();
		console.log('pg_dump: ', output);

		if (!(await dbdump.exists())) {
			throw new Error('dump doesnt exist');
		}

		output =
			await $`pg_restore --no-owner --no-acl --clean --if-exists -d "${restoreURl}" ${fileName}`.text();
		console.log('pg_restore: ', output);

		console.log('finished.');
	} catch (error) {
		console.error(error);
	} finally {
		rl.close();
		if (!(await dbdump.exists())) {
			await dbdump.delete();
		}
	}
}
main();
