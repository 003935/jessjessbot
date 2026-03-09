import { parseArgs } from "util";
import { BOT_TOKEN, CLIENT_ID, GUILD_ID } from '../src/environment';
import { REST, Routes } from "discord.js";

const rest = new REST().setToken(BOT_TOKEN);

const { values } = parseArgs({
    args: Bun.argv,
    options: {
        commandId: {
            type: "string",
        },
    },
    strict: true,
    allowPositionals: true
});

if (values.commandId === undefined) {
    rest
        .get(Routes.applicationCommands(CLIENT_ID))
        .then((_commands) => {
            console.log("global commands")
            const commands = _commands as { id: string, name: string, description: string }[]
            for (let i = 0; i < commands.length; i++) {
                const command = commands[i];
                console.log(command.id, command.name, command.description)

            }
        })
        .catch(console.error);

    rest
        .get(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID))
        .then((_commands) => {
            console.log("guild commands")
            const commands = _commands as { id: string, name: string, description: string }[]
            for (let i = 0; i < commands.length; i++) {
                const command = commands[i];
                console.log(command.id, command.name, command.description)
            }
        })
        .catch(console.error);

} else {
    // for global commands
    rest
        .delete(Routes.applicationCommand(CLIENT_ID, values.commandId))
        .then(() => console.log('Successfully deleted application command'))
        .catch(() => {
            console.log("Failed to delete global command, trying guild command")
            rest
                .delete(Routes.applicationGuildCommand(CLIENT_ID, GUILD_ID, values.commandId!))
                .then(() => console.log('Successfully deleted guild command'))
                .catch((e) => {
                    console.log(e)
                })
        });
}


