const { SlashCommandBuilder } = require('discord.js');
const fetch = require('node-fetch');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('temp')
        .setDescription('shows temperature in kowloon city'),
    async execute(client, interaction) {
        let temp = '';
        await fetch('https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=rhrread&lang=en')
            .then((response) => response.json())
            .then((json) => {
                temp = json.temperature.data.find(e => e.place == 'Kowloon City');
            });
        return interaction.reply(`the temperature in kowloon city is ${temp.value} °${temp.unit}`);
    }
};