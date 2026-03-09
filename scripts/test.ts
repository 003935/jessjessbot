import { REST, Routes } from 'discord.js';

import { Parse_Wordle_Message } from '../src/wordle';
import { WinnersTable } from '../src/db/wordle';
import { parseArgs } from "util";
import { BOT_TOKEN, GUILD_ID, WORDLE_BOT_ID } from '../src/environment';
import { exit } from 'process';
import { URLSearchParams } from 'url';

async function main() {
  const rest = new REST().setToken(BOT_TOKEN);
  const users = (await rest.get(Routes.guildMembersSearch(GUILD_ID), {
    query: new URLSearchParams({ limit: "5", query: "donkeyboy" })
  })) as { displayName: string, id: string }[]
  console.log(users[0])
}

main()

