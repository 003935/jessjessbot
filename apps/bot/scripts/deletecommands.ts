import { parseArgs } from 'util';
import { BOT_TOKEN, CLIENT_ID } from '@/environment';
import { REST, Routes } from 'discord.js';

const rest = new REST().setToken(BOT_TOKEN);

const { values } = parseArgs({
	args: Bun.argv,
	options: {
		commandId: {
			type: 'string',
		},
		guildId: {
			type: 'string',
		},
	},
	strict: true,
	allowPositionals: true,
});

if (values.commandId === undefined) {
	rest
		.get(Routes.applicationCommands(CLIENT_ID))
		.then((_commands) => {
			console.log('global commands');
			const commands = _commands as {
				id: string;
				name: string;
				description: string;
			}[];
			for (const command of commands) {
				console.log(command.id, command.name, command.description);
			}
		})
		.catch(console.error);

	if (values.guildId) {
		rest
			.get(Routes.applicationGuildCommands(CLIENT_ID, values.guildId))
			.then((_commands) => {
				console.log('guild commands');
				const commands = _commands as {
					id: string;
					name: string;
					description: string;
				}[];
				for (const command of commands) {
					console.log(command.id, command.name, command.description);
				}
			})
			.catch(console.error);
	}
} else {
	// for global commands
	rest
		.delete(Routes.applicationCommand(CLIENT_ID, values.commandId))
		.then(() => console.log('Successfully deleted application command'))
		.catch(() => {
			console.log('Failed to delete global command, trying guild command');
			if (values.guildId) {
				rest
					.delete(Routes.applicationGuildCommand(CLIENT_ID, values.guildId, values.commandId!))
					.then(() => console.log('Successfully deleted guild command'))
					.catch((e) => {
						console.log(e);
					});
			} else {
				console.log('No guildId provided');
			}
		});
}
