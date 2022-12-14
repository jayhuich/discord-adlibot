const fs = require('node:fs');
const path = require('node:path');
const { Routes } = require('discord.js');
const { REST } = require('@discordjs/rest');
const token = process.env.TOKEN || require('./config.json').token;
const clientId = process.env.CLIENT_ID || require('./config.json').clientId;
const devGuildId = process.env.DEV_GUILD_ID || require('./config.json').devGuildId;
const familyGuildId = process.env.FAMILY_GUILD_ID || require('./config.json').familyGuildId;

const commands = [], devCommands = [], familyCommands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if (file.startsWith('dev-')) devCommands.push(command.data.toJSON());
    else if (file.startsWith('family-')) familyCommands.push(command.data.toJSON());
    else commands.push(command.data.toJSON());
}

const rest = new REST({ version: '10' }).setToken(token);

rest.put(Routes.applicationCommands(clientId), { body: commands })
    .then(() => console.log('commands updated!'))
    .catch(console.error);
rest.put(Routes.applicationGuildCommands(clientId, devGuildId), { body: devCommands })
    .then(() => console.log('dev commands updated!'))
    .catch(console.error);